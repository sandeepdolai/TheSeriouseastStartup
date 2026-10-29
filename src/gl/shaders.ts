/**
 * Shader chunks ported from the reference site's WebGL bundle.
 * (jesperlandberg.com — recreated for study purposes.)
 */

/* ── shared helpers ─────────────────────────────────────────────────────── */

export const ROUNDED_BOX = /* glsl */ `
float roundedBox(vec2 p, vec2 mid, float r) {
        vec2 q = abs(p - mid) - (mid - r);
        return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
`;

export const UV_COVER = /* glsl */ `
vec2 uvCover(vec2 planeSize, vec2 imageSize, vec2 uv) {
        float planeRatio = planeSize.x / planeSize.y;
        float imageRatio = imageSize.x / imageSize.y;

        vec2 newSize = planeRatio < imageRatio
                ? vec2(imageSize.x * (planeSize.y / imageSize.y), planeSize.y)
                : vec2(planeSize.x, imageSize.y * (planeSize.x / imageSize.x));
        vec2 newOffset = (planeRatio < imageRatio
                ? vec2((newSize.x - planeSize.x) / 2.0, 0.0)
                : vec2(0.0, (newSize.y - planeSize.y) / 2.0)) / newSize;

        return uv * planeSize / newSize + newOffset;
}
`;

/* ── the sheet (the ribbon the cards travel on) ─────────────────────────── */

export const SHEET = /* glsl */ `
const float SHEET_PI = 3.141592653589793;

const float SHEET_BANK = -0.16;
const float SHEET_DIAG = 0.03;
const float SHEET_WAVE = 0.0;
const float SHEET_WAVE_F = 0.8;
const float SHEET_WAVE_PH = 0.35;
const float SHEET_REAR_Y = 0.1;
const float SHEET_REAR_Z = 0.2;
const float SHEET_VTWIST = 1.8;
const float SHEET_TAIL = 1.0;
const float SHEET_SHIFT = -0.2;

uniform float u_sheetW;
uniform float u_sheetD;
uniform float u_sheetT;
uniform float u_sheetC;
uniform float u_sheetP;
uniform float u_sheetV;
uniform float u_hover;
uniform float u_dent;

float sheetQ(float wx) {
        return wx / max(u_sheetW, 0.0001) * u_sheetT + SHEET_SHIFT;
}

float sheetShape(float q) {
        return mix(1.0 - q * q, sin(SHEET_PI * q), u_sheetC) * exp(-SHEET_TAIL * q * q);
}

float sheetShapeSlope(float q) {
        float g = exp(-SHEET_TAIL * q * q);

        float bowl = -2.0 * q * (1.0 + SHEET_TAIL * (1.0 - q * q));
        float ess = SHEET_PI * cos(SHEET_PI * q) - 2.0 * SHEET_TAIL * q * sin(SHEET_PI * q);

        return mix(bowl, ess, u_sheetC) * g;
}

float sheetZ(float wx) {
        return -u_sheetD * sheetShape(sheetQ(wx));
}

float sheetRoll(float wx) {
        if (u_sheetW < 0.001) return 0.0;
        return SHEET_BANK * sheetShapeSlope(sheetQ(wx)) / SHEET_PI * u_sheetC * u_sheetP;
}

vec4 sheetWind(vec4 w) {
        float a = sheetRoll(w.x);

        if (u_sheetV > 0.001 && u_sheetW > 0.001 && u_sheetP > 0.001) {
                float qe = w.x / u_sheetW;
                a += SHEET_VTWIST * u_sheetV * smoothstep(0.3, 0.9, abs(qe)) * sign(qe) * u_sheetP;
        }

        if (abs(a) < 0.0001) return w;

        float s = sin(a);
        float c = cos(a);

        return vec4(w.x, w.y * c - w.z * s, w.y * s + w.z * c, w.w);
}

vec4 sheet(vec4 w) {
        w = sheetWind(w);
        w.z += sheetZ(w.x) * u_sheetP;

        if (u_sheetW > 0.001) {
                float qw = w.x / u_sheetW;

                w.y += SHEET_DIAG * w.x * u_sheetP;
                w.y += SHEET_WAVE * u_sheetW *
                        sin(SHEET_PI * (qw * SHEET_WAVE_F + SHEET_WAVE_PH)) * u_sheetP;

                if (u_sheetV > 0.001) {
                        float m = 1.0 - smoothstep(-1.0, 0.3, qw);
                        w.y += SHEET_REAR_Y * u_sheetW * u_sheetV * m * u_sheetP;
                        w.z += SHEET_REAR_Z * u_sheetW * u_sheetV * m * u_sheetP;
                }
        }

        return w;
}

float sheetDome(vec2 uv) {
        vec2 q = uv * 2.0 - 1.0;
        return (1.0 - q.x * q.x) * (1.0 - q.y * q.y);
}

float sheetShade(float wx, vec2 uv, float resY) {
        if (u_sheetD < 0.001) return 0.0;

        float d = u_sheetW > 0.001 && u_sheetP > 0.001
                ? clamp((u_sheetD - sheetZ(wx)) / (2.0 * u_sheetD), 0.0, 1.0) * u_sheetP
                : 0.0;

        if (u_hover > 0.0001) {
                d += (u_hover * u_dent * resY * sheetDome(uv)) / (2.0 * u_sheetD);
        }

        return clamp(d, 0.0, 1.0);
}

float sheetOffset(float wx, vec2 uv, float resY) {
        float z = 0.0;

        if (u_sheetW > 0.001 && u_sheetP > 0.001 && u_sheetD > 0.001) z += sheetZ(wx) * u_sheetP;
        if (u_leanW > 0.001) z += u_leanA * leanRamp(wx / u_leanW) * u_sheetP;
        if (u_hover > 0.0001) z -= u_hover * u_dent * resY * sheetDome(uv);

        return z;
}

vec3 sheetNormal(float wx, vec2 uv, vec2 res) {
        float dzdx = 0.0;
        float dzdy = 0.0;

        if (u_sheetW > 0.001 && u_sheetP > 0.001 && u_sheetD > 0.001) {
                dzdx += -u_sheetD * sheetShapeSlope(sheetQ(wx)) * u_sheetT / u_sheetW * u_sheetP;
        }

        if (u_leanW > 0.001) {
                dzdx += (u_leanA / u_leanW) * leanSlope(wx / u_leanW) * u_sheetP;
        }

        if (u_hover > 0.0001) {
                vec2 q = uv * 2.0 - 1.0;
                float a = u_hover * u_dent;

                dzdx += 4.0 * a * res.y * q.x * (1.0 - q.y * q.y) / max(res.x, 0.0001);
                dzdy += 4.0 * a * q.y * (1.0 - q.x * q.x);
        }

        vec3 n = normalize(vec3(-dzdx, -dzdy, 1.0));

        float a = sheetRoll(wx);

        if (abs(a) > 0.0001) {
                float s = sin(a);
                float c = cos(a);
                n = vec3(n.x, n.y * c - n.z * s, n.y * s + n.z * c);
        }

        return n;
}
`;

/* ── the door (lean) ────────────────────────────────────────────────────── */

export const LEAN = /* glsl */ `
uniform float u_leanA;
uniform float u_leanW;

float leanRamp(float s) {
        s = clamp(s, -1.0, 1.0);
        return s * (1.5 - 0.5 * s * s);
}

float leanSlope(float s) {
        s = min(abs(s), 1.0);
        return 1.5 * (1.0 - s * s);
}

vec4 lean(vec4 w, float k) {
        if (u_leanW > 0.001 && k > 0.001) {
                w.z += u_leanA * leanRamp(w.x / u_leanW) * k;
        }
        return w;
}
`;

/* ── the bulge (vertical scroll swell) ──────────────────────────────────── */

export const BULGE = /* glsl */ `
uniform float u_bulgeA;
uniform float u_bulgeH;

vec4 bulge(vec4 w) {
        if (u_bulgeH > 0.001) {
                float t = clamp(w.y / u_bulgeH, -1.0, 1.0);
                w.z += u_bulgeA * (1.0 - t * t);
        }
        return w;
}
`;

/* ── the sheen ──────────────────────────────────────────────────────────── */

export const SHEET_LIGHT = /* glsl */ `
const vec3 LIGHT_DIR = normalize(vec3(-0.4, 0.5, 1.0));
const float LIGHT_GLOSS = 48.0;
const float LIGHT_SPEC = 0.35;
const float LIGHT_DIFF = 0.12;

vec3 sheetLit(vec3 col, vec3 n, vec3 v, float amt) {
        if (amt < 0.001) return col;

        float d = dot(n, LIGHT_DIR) * 0.5 + 0.5;

        col *= 1.0 - LIGHT_DIFF * amt * (1.0 - d);

        vec3 h = normalize(LIGHT_DIR + v);

        return col + pow(max(dot(n, h), 0.0), LIGHT_GLOSS) * LIGHT_SPEC * amt;
}
`;

/* ── card vertex shader ─────────────────────────────────────────────────── */

export const CARD_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vFlat;

uniform vec2 u_res;

#include <chunks>

void main() {
        vUv = uv;

        vec3 p = position;

        if (u_hover > 0.0001) {
                p.z -= u_hover * u_dent * u_res.y * sheetDome(uv);
        }

        vec4 w = modelMatrix * vec4(p, 1.0);
        w = sheet(w);
        w = lean(w, u_sheetP);
        w = bulge(w);

        vFlat = w.xyz;

        gl_Position = projectionMatrix * viewMatrix * w;
}
`;

/* ── card fragment shader ───────────────────────────────────────────────── */

export const CARD_FRAG = /* glsl */ `
uniform sampler2D u_texture;
uniform vec2 u_size;
uniform vec2 u_res;
uniform float u_alpha;
uniform float u_shade;
uniform float u_shadeS;
uniform float u_corner;
uniform float u_white;
uniform vec3 u_wash;
uniform float u_scrim;

varying vec2 vUv;
varying vec3 vFlat;

#include <chunks>

void main() {
        vec4 tex = texture2D(u_texture, uvCover(u_res, u_size, vUv));

        if (u_shade > 0.001) {
                float depth = sheetShade(vFlat.x, vUv, u_res.y);

                tex.rgb = mix(tex.rgb, vec3(0.059), u_shade * 0.8 * pow(depth, u_shadeS));

                vec3 p = vFlat + vec3(0.0, 0.0, sheetOffset(vFlat.x, vUv, u_res.y));

                tex.rgb = sheetLit(
                        tex.rgb,
                        sheetNormal(vFlat.x, vUv, u_res),
                        normalize(cameraPosition - p),
                        u_shade
                );
        }

        if (u_scrim > 0.001) {
                float g = 1.0 - smoothstep(0.0, 0.5, vUv.y);
                tex.rgb = mix(tex.rgb, vec3(0.0), u_scrim * 0.65 * g * g);
        }

        tex.rgb = mix(tex.rgb, u_wash, u_white);

        float alpha = u_alpha;

        if (u_corner > 0.0001) {
                vec2 sz = vec2(u_res.x / max(u_res.y, 0.0001), 1.0);
                vec2 mid = sz * 0.5;
                float r = min(u_corner, min(mid.x, mid.y));

                float d = roundedBox(vUv * sz, mid, r);

                float aa = max(fwidth(d), 0.0001);

                alpha *= 1.0 - smoothstep(-aa, aa, d);
        }

        gl_FragColor = vec4(tex.rgb, alpha);
}
`;

/* ── backdrop (solid fill) ──────────────────────────────────────────────── */

export const BACKDROP_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const BACKDROP_FRAG = /* glsl */ `
uniform vec3 u_c0;
void main() {
        gl_FragColor = vec4(u_c0, 1.0);
}
`;

/* ── the ground (grid floor) ────────────────────────────────────────────── */

export const GROUND_VERT = /* glsl */ `
uniform float u_run;

varying vec2 vUv;
varying vec3 vWorld;
varying float vFar;

void main() {
        vUv = uv;

        vec4 w = modelMatrix * vec4(position, 1.0);

        // 0 where the cards stand (z = 0), 1 at the far edge, negative toward camera
        vFar = -w.z / u_run;
        vWorld = w.xyz;

        gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const GROUND_FRAG = /* glsl */ `
uniform vec3 u_c0;
uniform vec3 u_c1;
uniform float u_alpha;
uniform float u_grid;
uniform vec2 u_gridF;

uniform sampler2D u_refl;
uniform float u_reflA;
uniform mat4 u_reflVP;
uniform float u_reflSpread;
uniform float u_reflLX;

varying vec2 vUv;
varying vec3 vWorld;
varying float vFar;

void main() {
        float fade = 1.0 - smoothstep(0.2, 0.95, vFar);

        float contact = exp(-abs(vFar) * 14.0);

        vec3 col = mix(u_c1, u_c0, smoothstep(0.0, 0.8, vFar));
        col *= 1.0 - contact * 0.55;

        vec2 g = vec2(vUv.x * u_gridF.x, vFar * u_gridF.y);
        vec2 gf = abs(fract(g) - 0.5);
        vec2 gw = fwidth(g) * 1.5;

        vec2 lines = vec2(1.0) - smoothstep(vec2(0.0), gw, gf);
        float line = max(lines.x, lines.y);

        col += line * u_grid * fade;

        if (u_reflA > 0.001) {
                vec3 wp = vWorld;
                wp.x -= (vWorld.x - u_reflLX) * u_reflSpread * abs(vFar);

                vec4 rp = u_reflVP * vec4(wp, 1.0);
                vec2 ruv = (rp.xy / max(rp.w, 0.0001)) * 0.5 + 0.5;

                vec2 soft = smoothstep(vec2(0.0), vec2(0.1), ruv)
                        * (vec2(1.0) - smoothstep(vec2(0.9), vec2(1.0), ruv));
                float ok = soft.x * soft.y;

                vec3 refl = texture2D(u_refl, ruv).rgb;

                float fall = exp(-((vFar > 0.0) ? vFar * 6.0 : -vFar * 2.2));

                col += refl * line * u_reflA * fall * ok * fade;
        }

        gl_FragColor = vec4(col, u_alpha * fade);
}
`;

/* ── the veil (top/bottom vignette) ─────────────────────────────────────── */

export const VEIL_FRAG = /* glsl */ `
varying vec2 vUv;
uniform float u_alpha;
uniform float u_edge;
uniform float u_max;
void main() {
        float g = smoothstep(1.0 - u_edge, 1.0, vUv.y);
        g = max(g, smoothstep(u_edge, 0.0, vUv.y));
        g *= g;
        gl_FragColor = vec4(vec3(0.0), u_alpha * u_max * g);
}
`;

/* ── the hole (black-hole lens overlay) ─────────────────────────────────── */

export const HOLE_FRAG = /* glsl */ `
uniform sampler2D u_scene;
uniform vec2 u_aspect;
uniform float u_time;
uniform vec2 u_center;
uniform float u_p;
uniform float u_radius;
uniform float u_lens;
uniform float u_reach;
uniform float u_orbit;
uniform float u_wave;
uniform float u_aberr;
uniform float u_emax;
uniform float u_glint;
uniform float u_glintW;
uniform float u_px;

varying vec2 vUv;

#define PI 3.14159265

float widthUnit() {
        return u_aspect.x;
}

float lobes(float a) {
        return sin(a * 3.0 + u_time * 0.7) * 0.6 + sin(a * 5.0 - u_time * 0.45) * 0.4;
}

float radius(float p, float n) {
        return p * u_radius + n * sin(PI * clamp(p, 0.0, 1.0));
}

vec4 grab(float kind, vec2 dir, float rad) {
        vec2 uv = (dir * rad * widthUnit()) / u_aspect + u_center;

        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0, 0.0, 0.0, 1.0);
        return texture2D(u_scene, uv);
}

float pull(float t, float e, float fall) {
        return fall * (e * e) / max(t, 0.001);
}

float inside(float d) {
        float aa = max(fwidth(d), 0.0001);
        return 1.0 - smoothstep(-aa, aa, d);
}

vec3 glint(float d, float p) {
        float w = max(u_glintW, 1.5 * u_px);
        float s = w;

        float g = exp(-(d * d) / (w * w));
        float r = exp(-((d - s) * (d - s)) / (w * w));
        float b = exp(-((d + s) * (d + s)) / (w * w));

        return vec3(r, g, b) * u_glint * smoothstep(0.0, 0.03, p);
}

void main() {
        vec2 q = (vUv - u_center) * u_aspect;

        float t = length(q) / widthUnit();
        vec2 dir = length(q) > 0.00001 ? normalize(q) : vec2(1.0, 0.0);
        float n = lobes(atan(q.y, q.x)) * u_wave;

        float r1 = radius(u_p, n);

        float b = t;
        float e = min(r1 * u_lens, u_emax);
        float split = e * u_aberr;
        float fall = 1.0 - smoothstep(r1, r1 + u_reach, t);

        b -= pull(t, e, fall);
        float bR = b - split * fall;
        float bB = b + split * fall;

        float near = 1.0 - smoothstep(0.0, 0.08, abs(t - r1));
        float part = 0.0008 * near;
        bR -= part;
        bB += part;

        vec3 c = vec3(grab(0.0, dir, bR).r, grab(0.0, dir, b).g, grab(0.0, dir, bB).b);
        c *= 1.0 - 0.35 * fall;
        c += glint(t - r1, u_p);

        gl_FragColor = vec4(c, 1.0);
}
`;

/* ── the cursor ball (glowing orb + trail) ──────────────────────────────── */

export const BALL_FRAG = /* glsl */ `
varying vec2 vUv;
uniform float u_a;
uniform float u_rad;
uniform float u_trail;
uniform vec2 u_pos;
uniform vec2 u_trailPos;
uniform float u_aspect;

float segDist(vec2 p, vec2 a, vec2 b) {
	vec2 pa = p - a, ba = b - a;
	float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
	return length(pa - ba * h);
}

void main() {
	vec2 asp = vec2(u_aspect, 1.0);

	float d = length((vUv - u_pos) * asp);

	float disc = smoothstep(u_rad, u_rad - 0.006, d);

	float td = segDist(vUv * asp, u_pos * asp, u_trailPos * asp);
	float segLen = distance(u_pos * asp, u_trailPos * asp);
	float taper = clamp(segLen / 0.1, 0.0, 1.0);
	float tail = smoothstep(0.02 * mix(0.3, 1.0, taper), 0.0, td) * u_trail;

	float halo = smoothstep(u_rad * 3.2, 0.0, d) * 0.3;

	float glow = tail * 0.9 + halo;

	vec3 col = vec3(0.92, 0.96, 1.0);

	float light = disc * 0.95 + glow;

	gl_FragColor = vec4(col * light, clamp(light, 0.0, 1.0) * u_a);
}
`;
