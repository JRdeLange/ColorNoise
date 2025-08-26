#version 300 es
precision highp float;

out vec4 fragColor;

// Matches your JS
uniform vec2  u_resolution;
uniform float u_time;

// --------- Tweakables (super cheap) ----------
const float SCALE          = 1.6;  // base frequency
const int   OCTAVES        = 3;    // try 2 for ultra speed
const float LACUNARITY     = 2.0;  // freq multiplier
const float GAIN           = 0.5;  // amplitude falloff
const float PEAKINESS      = 0.65; // 0 = soft, 1 = peaky/ridged feel
const float CONTRAST_POW   = 1.0;  // extra shaping (1 = none)
const float SCROLL_SPEED_Z = 0.25; // scroll through Z
// ---------------------------------------------

// Dave Hoskins–style float hash (no trig, very cheap)
float hash13(vec3 p){
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

// Smoothstep-like fade for value noise
vec3 fade(vec3 t){ return t*t*(3.0 - 2.0*t); }

// 3D value noise: hash lattice + trilinear interp
float valueNoise(vec3 p){
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = fade(f);

  float n000 = hash13(i + vec3(0.0,0.0,0.0));
  float n100 = hash13(i + vec3(1.0,0.0,0.0));
  float n010 = hash13(i + vec3(0.0,1.0,0.0));
  float n110 = hash13(i + vec3(1.0,1.0,0.0));
  float n001 = hash13(i + vec3(0.0,0.0,1.0));
  float n101 = hash13(i + vec3(1.0,0.0,1.0));
  float n011 = hash13(i + vec3(0.0,1.0,1.0));
  float n111 = hash13(i + vec3(1.0,1.0,1.0));

  float nx00 = mix(n000, n100, u.x);
  float nx10 = mix(n010, n110, u.x);
  float nx01 = mix(n001, n101, u.x);
  float nx11 = mix(n011, n111, u.x);

  float nxy0 = mix(nx00, nx10, u.y);
  float nxy1 = mix(nx01, nx11, u.y);

  return mix(nxy0, nxy1, u.z); // already ~[0,1)
}

// Lightweight fBm (normalized by total amp)
float fbm(vec3 p){
  float sum = 0.0;
  float amp = 0.5;
  float norm= 0.0;
  vec3  pp  = p;
  for(int i=0;i<OCTAVES;i++){
    sum  += valueNoise(pp) * amp;
    norm += amp;
    pp   *= LACUNARITY;
    amp  *= GAIN;
  }
  return sum / max(norm, 1e-6);
}

// Cheap “ridge/peak” shaping on a [0,1] signal
float ridgeShape(float n){
  // 1 - |2n-1| gives a tent; square it for sharper peaks
  float r = 1.0 - abs(n*2.0 - 1.0);
  return r*r;
}

void main(){
  // Pixel coords -> normalized uv centered at 0
  vec2 uv = (gl_FragCoord.xy - 0.5*u_resolution) / u_resolution.y;

  // 3D point (Z scrolls over time)
  vec3 p = vec3(uv * SCALE, u_time * SCROLL_SPEED_Z);

  // Base fBm
  float base = fbm(p);

  // Blend in peakiness without extra octaves
  float shaped = mix(base, ridgeShape(base), clamp(PEAKINESS, 0.0, 1.0));

  // Optional contrast shaping
  float n = pow(clamp(shaped, 0.0, 1.0), max(0.0001, CONTRAST_POW));

  fragColor = vec4(vec3(n), 1.0);
}
