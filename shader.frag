#version 300 es
precision highp float;

out vec4 outColor;
uniform vec2 u_resolution;
uniform float u_time;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec3 color = 0.5 + 0.5 * cos(6.28318 * (vec3(uv, 0.0) + u_time*0.05) + vec3(0.0, 2.0, 4.0));
  outColor = vec4(color, 1.0);
}
