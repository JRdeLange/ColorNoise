// app.js
// -- GLOBALS
const canvas = document.getElementById('gl');
const gl = canvas.getContext('webgl2');
if (!gl) throw new Error("WebGL2 not supported");
// -- GLOBALS

async function loadText(url) {
    // -- LOAD
    const res = await fetch(url);
    return await res.text();
    // -- LOAD
}

async function init() {
    // -- SHADER
    const vertSrc = await loadText("shader.vert");
    // const fragSrc = await loadText("shader.frag");
    const fragSrc = await loadText("my_noise.frag");

    const vs = compile(gl.VERTEX_SHADER, vertSrc);
    const fs = compile(gl.FRAGMENT_SHADER, fragSrc);

    const program = linkProgram(vs, fs);
    gl.useProgram(program);
    // -- SHADER

    // -- UNIFORMS
    const uResolution = gl.getUniformLocation(program, "u_resolution");
    const uTime = gl.getUniformLocation(program, "u_time");
    // -- UNIFORMS

    function resize() {
        // -- RESIZE
        const dpr = window.devicePixelRatio || 1;
        canvas.width = innerWidth * dpr;
        canvas.height = innerHeight * dpr;
        gl.viewport(0, 0, canvas.width, canvas.height);
        // -- RESIZE
    }
    addEventListener("resize", resize);
    resize();

    const random_nr = Math.random() * 5000 - 2500;

    const t0 = performance.now();
    function frame() {
        // -- FRAME
        const t = (performance.now() - t0) * 0.001;

        // -- SET UNIFORMS
        gl.uniform2f(uResolution, canvas.width, canvas.height);
        gl.uniform1f(uTime, t + random_nr);
        // -- SET UNIFORMS

        gl.drawArrays(gl.TRIANGLES, 0, 3);
        requestAnimationFrame(frame);
        // -- FRAME
    }
    requestAnimationFrame(frame);
}

function compile(type, src) {
    // -- COMPILE
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(s));
    return s;
    // -- COMPILE
}
function linkProgram(vs, fs) {
    // -- LINK
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
        throw new Error(gl.getProgramInfoLog(p));
    return p;
    // -- LINK
}

init();
