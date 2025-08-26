#version 300 es
precision highp float;

out vec4 fragColor;

// --- Inputs (rename to your engine's naming if needed) ---
uniform vec2  u_resolution;    // screen size (px)
uniform float u_time;          // seconds

// --- Tweakables ---
const float uScale        = 1.75;  // base frequency (bigger -> finer detail)
const int   uOctaves      = 5;     // 1..8 is reasonable
const float uLacunarity   = 2.0;   // freq multiplier per octave
const float uGain         = 0.5;   // amp falloff per octave
const float uPeakiness    = 0.65;  // 0=soft fbm, 1=ridged peaks
const float uRidgeOffset  = 1.0;   // ridged shape offset (≈1.0)
const float uContrastPow  = 1.0;   // optional extra shaping (1 = none)
const float uWarp         = 0.15;  // small domain warp amount (0 disables)
const float uScrollSpeedZ = 0.25;  // how fast we move through Z

// ---------------------------------------------------------
// 3D Simplex noise (public-domain style, adapted for GLSL)
// ---------------------------------------------------------
vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 mod289(vec4 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314*r; }

float snoise(vec3 v){
  const vec2  C = vec2(1.0/6.0, 1.0/3.0);
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

  // Skew the cell and find simplex corner coords
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g  = step(x0.yzx, x0.xyz);
  vec3 l  = 1.0 - g;
  vec3 i1 = min(g, l.zxy);
  vec3 i2 = max(g, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;  // 1/7
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j  = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.y;
  vec4 y = y_ * ns.x + ns.y;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3  g0 = vec3(a0.xy, h.x);
  vec3  g1 = vec3(a0.zw, h.y);
  vec3  g2 = vec3(a1.xy, h.z);
  vec3  g3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(g0,g0), dot(g1,g1),
                                 dot(g2,g2), dot(g3,g3)));
  g0 *= norm.x; g1 *= norm.y; g2 *= norm.z; g3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1),
                          dot(x2,x2), dot(x3,x3)), 0.0);
  m = m*m;

  return 42.0 * dot(m*m, vec4(dot(g0,x0), dot(g1,x1),
                               dot(g2,x2), dot(g3,x3)));
}

// ---------------------------
// fBm + Ridged multifractal
// ---------------------------
#define MAX_OCTAVES 8

float fbm(vec3 p){
  float a = 0.5;
  float s = 0.0;
  float amp = a;
  vec3  pp = p;
  for(int i=0;i<MAX_OCTAVES;i++){
    if(i >= uOctaves) break;
    s   += snoise(pp) * amp;
    pp  *= uLacunarity;
    amp *= uGain;
  }
  // Map from roughly [-1,1] to [0,1]
  return s * 0.5 + 0.5;
}

float ridge(float n, float offset){
  n = abs(n);
  n = offset - n;     // invert valleys to peaks
  n = n * n;          // sharpen
  return n;
}

float ridgedFbm(vec3 p){
  float sum = 0.0;
  float amp = 0.5;
  vec3  pp  = p;
  for(int i=0;i<MAX_OCTAVES;i++){
    if(i >= uOctaves) break;
    float r = ridge(snoise(pp), uRidgeOffset);
    sum += r * amp;
    pp  *= uLacunarity;
    amp *= uGain;
  }
  return clamp(sum, 0.0, 1.0);
}

// Optional lightweight domain warp (1 extra octave’s worth)
vec3 warp(vec3 p){
  if(uWarp <= 0.0) return p;
  vec3 w = vec3(
    snoise(p*1.7 + 11.0),
    snoise(p*1.7 - 19.0),
    snoise(p*1.7 +  3.0)
  );
  return p + w * uWarp;
}

void main(){
  // Pixel coords -> normalized uv centered at 0
  vec2 uv = (gl_FragCoord.xy - 0.5*u_resolution) / u_resolution.y;

  // Build 3D point, scroll through Z over time
  vec3 p = vec3(uv * uScale, u_time * uScrollSpeedZ);

  // Optional domain warp to add subtle curvature without big cost
  p = warp(p);

  // Blend normal fBm with ridged fBm using uPeakiness
  float n  = mix(fbm(p), ridgedFbm(p), clamp(uPeakiness, 0.0, 1.0));

  // Optional extra shaping for “craggy” look
  n = pow(clamp(n, 0.0, 1.0), max(0.0001, uContrastPow));

  // Simple grayscale; replace with your terrain/height mapping
  vec3 col = vec3(n);

  fragColor = vec4(col, 1.0);
}
