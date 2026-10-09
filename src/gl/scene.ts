import * as THREE from "three";
import {
  BACKDROP_FRAG,
  BACKDROP_VERT,
  BALL_FRAG,
  BULGE,
  CARD_FRAG,
  CARD_VERT,
  GROUND_FRAG,
  GROUND_VERT,
  HOLE_FRAG,
  LEAN,
  ROUNDED_BOX,
  SHEET,
  SHEET_LIGHT,
  UV_COVER,
  VEIL_FRAG,
} from "./shaders";

/** camera constants from the reference */
const FOV = 53.4;
const CAM_Z = 41.18;

/** env (ground) config from the reference */
const MI = {
  tint: "#000000",
  alpha: 0.9,
  drop: 0.06,
  run: 6,
  wide: 4,
  cell: 0.22,
  grid: 0.08,
  lip: 0.2,
  refl: 0.5,
  reflGap: 0.02,
  reflSpread: 0.35,
  reflLight: 0.6,
};

const DENT = 0.1;

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CardEntry {
  el: HTMLElement;
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  slug: string;
  ox: number;
  hover: number;
  flying?: boolean;
}

export class Folio {
  renderer!: THREE.WebGLRenderer;
  camera!: THREE.PerspectiveCamera;
  scene = new THREE.Scene();
  cards: CardEntry[] = [];
  small = false;
  ww = 0;
  wh = 0;

  private backdrop!: THREE.Mesh;
  private ground!: THREE.Mesh;
  private veil!: THREE.Mesh;
  private hole!: THREE.Mesh;
  private ball!: THREE.Mesh;
  private sceneRT!: THREE.WebGLRenderTarget;
  private reflRT!: THREE.WebGLRenderTarget;
  private reflCamera!: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private raf = 0;
  private mounted = false;

  vel = 0;
  scrollV = 0;
  bulge = 0;

  holeP = 0;
  holeTarget = 0;
  ballState = { on: false, seen: false, p: 0, x: 0, y: 0, sx: 0, sy: 0, e: 0 };

  private groundAlpha = 0;
  private veilAlpha = 0;

  /** called every frame before render — the app syncs DOM → meshes here */
  onFrame?: (dt: number) => void;

  mount(container: HTMLElement) {
    if (this.mounted) return;
    this.mounted = true;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 1);
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 2000);
    this.camera.position.set(0, 0, CAM_Z);

    this.reflCamera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 2000);
    this.reflCamera.position.set(0, 0, CAM_Z);

    // backdrop
    this.backdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: BACKDROP_VERT,
        fragmentShader: BACKDROP_FRAG,
        uniforms: { u_c0: { value: new THREE.Color(0x000000) } },
        depthTest: false,
        depthWrite: false,
      })
    );
    this.backdrop.renderOrder = -2;
    this.backdrop.frustumCulled = false;
    this.scene.add(this.backdrop);

    // ground grid
    const gg = new THREE.PlaneGeometry(1, 1, 96, 48);
    gg.rotateX(-Math.PI / 2);
    this.ground = new THREE.Mesh(
      gg,
      new THREE.ShaderMaterial({
        vertexShader: GROUND_VERT,
        fragmentShader: GROUND_FRAG,
        uniforms: {
          u_c0: { value: new THREE.Color(0x000000) },
          u_c1: { value: new THREE.Color(MI.tint) },
          u_alpha: { value: 0 },
          u_grid: { value: MI.grid },
          u_gridF: { value: new THREE.Vector2(1, 1) },
          u_refl: { value: null },
          u_reflA: { value: 0 },
          u_reflVP: { value: new THREE.Matrix4() },
          u_reflSpread: { value: MI.reflSpread },
          u_reflLX: { value: 0 },
          u_run: { value: 1 },
        },
        transparent: true,
        depthTest: false,
        depthWrite: false,
      })
    );
    this.ground.renderOrder = -1;
    this.ground.frustumCulled = false;
    this.ground.visible = false;
    this.scene.add(this.ground);

    // veil
    this.veil = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: BACKDROP_VERT,
        fragmentShader: VEIL_FRAG,
        uniforms: {
          u_alpha: { value: 0 },
          u_edge: { value: 0.26 },
          u_max: { value: 1 },
        },
        transparent: true,
        depthTest: false,
        depthWrite: false,
      })
    );
    this.veil.renderOrder = 3.5;
    this.veil.frustumCulled = false;
    this.scene.add(this.veil);

    // cursor ball
    this.ball = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: BACKDROP_VERT,
        fragmentShader: BALL_FRAG,
        uniforms: {
          u_a: { value: 0 },
          u_rad: { value: 0.028 },
          u_trail: { value: 0 },
          u_pos: { value: new THREE.Vector2(0.5, 0.5) },
          u_trailPos: { value: new THREE.Vector2(0.5, 0.5) },
          u_aspect: { value: 1 },
        },
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.ball.renderOrder = 4;
    this.ball.frustumCulled = false;
    this.ball.visible = false;
    this.ballScene.add(this.ball);

    // hole post
    this.hole = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: BACKDROP_VERT,
        fragmentShader: HOLE_FRAG,
        uniforms: {
          u_scene: { value: null },
          u_aspect: { value: new THREE.Vector2(1, 1) },
          u_time: { value: 0 },
          u_center: { value: new THREE.Vector2(0.5, 0.5) },
          u_p: { value: 0 },
          u_radius: { value: 0.115 },
          u_lens: { value: 1.5 },
          u_reach: { value: 0.09 },
          u_orbit: { value: 0.3 },
          u_wave: { value: 0.05 },
          u_aberr: { value: 0.004 },
          u_glint: { value: 0.3 },
          u_glintW: { value: 0.0015 },
          u_px: { value: 0.001 },
        },
        depthTest: false,
        depthWrite: false,
      })
    );
    this.hole.renderOrder = 6;
    this.hole.frustumCulled = false;
    this.hole.visible = false;
    this.holeScene.add(this.hole);

    this.sceneRT = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    this.reflRT = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });

    this.resize();
    window.addEventListener("resize", this.resize);
    this.clock.start();
    this.loop();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    this.renderer?.dispose();
    this.mounted = false;
  }

  resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.ww = w;
    this.wh = h;
    this.small = w < 650;
    this.renderer?.setSize(w, h);
    if (this.camera) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    if (this.reflCamera) {
      this.reflCamera.aspect = w / h;
      this.reflCamera.updateProjectionMatrix();
    }
    const dpr = this.renderer?.getPixelRatio() ?? 1;
    if (this.sceneRT) this.sceneRT.setSize(Math.floor(w * dpr), Math.floor(h * dpr));
    if (this.reflRT)
      this.reflRT.setSize(
        Math.max(2, Math.floor((w * dpr) / 10)),
        Math.max(2, Math.floor((h * dpr) / 10))
      );
    if (this.hole) {
      const u = (this.hole.material as THREE.ShaderMaterial).uniforms;
      u.u_aspect.value.set(w / h, h / w);
      u.u_px.value = 1 / w;
    }
    if (this.ball) {
      const u = (this.ball.material as THREE.ShaderMaterial).uniforms;
      u.u_aspect.value = w / h;
    }
  };

  /** frustum half sizes at z=0 */
  get frustum() {
    const t = (this.camera.fov * Math.PI) / 180;
    const H = Math.tan(t / 2) * this.camera.position.z;
    return { W: H * this.camera.aspect, H };
  }

  /** the sheet config (from reference: sheet()) */
  get sheetCfg() {
    const { W, H } = this.frustum;
    const vel = Math.min(1, Math.abs(this.vel));
    const depth = this.small ? 0.18 : 0.2;
    const span = this.small ? 1 : 1.15;
    const C = this.small ? 0 : 1;
    const door = this.small ? 0 : -0.12;
    return {
      W,
      H,
      D: W * depth * (1 + 1.1 * vel),
      V: vel,
      T: span,
      C,
      A: W * door,
    };
  }

  pose(r: Rect) {
    const { W, H } = this.frustum;
    const l = (r.width / this.ww) * (W * 2);
    const u = (r.height / this.wh) * (H * 2);
    return {
      pos: new THREE.Vector3(
        -W + l / 2 + (r.left / this.ww) * W * 2,
        H - u / 2 - (r.top / this.wh) * H * 2,
        0
      ),
      scale: new THREE.Vector3(l, u, 1),
    };
  }

  /** set scroll velocity (horizontal carousel) */
  setVelocity(v: number) {
    const norm = this.small ? 500 : 900;
    const t = Math.tanh(v / norm);
    this.vel = t * Math.abs(t);
  }

  /** set scroll (vertical, mobile) */
  setScroll(v: number) {
    const norm = this.small ? 500 : 900;
    const t = Math.tanh(v / norm);
    const { H } = this.frustum;
    this.scrollV = t;
    this.bulge = t * Math.abs(t) * 0.22 * H;
  }

  registerCard(el: HTMLElement, texture: THREE.Texture, slug: string, size: THREE.Vector2) {
    // remove previous entry for slug
    this.removeCard(slug);
    const geo = new THREE.PlaneGeometry(1, 1, 48, 24);
    const mat = new THREE.ShaderMaterial({
      vertexShader: replaceChunks(CARD_VERT),
      fragmentShader: replaceChunks(CARD_FRAG),
      uniforms: {
        u_texture: { value: texture },
        u_size: { value: size },
        u_res: { value: new THREE.Vector2(1, 1) },
        u_alpha: { value: 0 },
        u_shade: { value: 1 },
        u_shadeS: { value: 1 },
        u_corner: { value: 0 },
        u_hover: { value: 0 },
        u_dent: { value: DENT },
        u_white: { value: 0 },
        u_wash: { value: new THREE.Color(0xffffff) },
        u_scrim: { value: 0 },
        u_sheetW: { value: 0 },
        u_sheetD: { value: 0 },
        u_sheetV: { value: 0 },
        u_sheetT: { value: 1 },
        u_sheetC: { value: 1 },
        u_sheetP: { value: 1 },
        u_leanA: { value: 0 },
        u_leanW: { value: 0 },
        u_bulgeA: { value: 0 },
        u_bulgeH: { value: 0 },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 0;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    const entry: CardEntry = { el, mesh, slug, ox: 0, hover: 0 };
    this.cards.push(entry);
    return entry;
  }

  removeCard(slug: string) {
    const i = this.cards.findIndex((c) => c.slug === slug);
    if (i > -1) {
      const c = this.cards[i];
      this.scene.remove(c.mesh);
      c.mesh.geometry.dispose();
      c.mesh.material.dispose();
      this.cards.splice(i, 1);
    }
  }

  /** sync a card mesh to a (virtual) rect */
  syncCard(entry: CardEntry, rect: Rect) {
    const p = this.pose(rect);
    const offX = entry.ox * (this.ww / Math.max(this.frustum.W, 0.0001));
    const r = { ...rect, left: rect.left + offX };
    const p2 = this.pose(r);
    entry.mesh.position.copy(p2.pos);
    entry.mesh.scale.copy(p.scale);
    const u = entry.mesh.material.uniforms;
    u.u_res.value.set(p.scale.x, p.scale.y);
    const sheet = this.sheetCfg;
    u.u_sheetW.value = sheet.W;
    u.u_sheetD.value = sheet.D;
    u.u_sheetV.value = sheet.V;
    u.u_sheetT.value = sheet.T;
    u.u_sheetC.value = sheet.C;
    u.u_leanA.value = sheet.A;
    u.u_leanW.value = sheet.W;
    u.u_bulgeA.value = this.bulge;
    u.u_bulgeH.value = sheet.H;
    // rounded corner: CSS border radius / height
    const radiusPx = this.small ? 1.5 * 10 * (this.ww / 390) : 2 * 10 * (this.ww / 1500);
    u.u_corner.value = rect.height ? Math.min(0.5, radiusPx / rect.height) : 0;
  }

  /** fly a card to a target rect (page transition), washing it white */
  flyCard(slug: string, toRect: Rect, duration = 1, onProgress?: (p: number) => void): Promise<void> {
    const entry = this.cards.find((c) => c.slug === slug);
    if (!entry) return Promise.resolve();
    entry.flying = true;
    const fromRect = (entry.el as any)._vrect ?? rectOf(entry.el);
    const fromPose = this.pose(fromRect);
    const toPose = this.pose(toRect);
    const fromCorner = entry.mesh.material.uniforms.u_corner.value as number;
    const toRadius = this.small ? 1.5 * 10 * (this.ww / 390) : 2 * 10 * (this.ww / 1500);
    const toCorner = toRect.height ? Math.min(0.5, toRadius / toRect.height) : 0.15;
    const u = entry.mesh.material.uniforms;

    return new Promise((resolve) => {
      const start = performance.now();
      const step = (now: number) => {
        const raw = Math.min(1, (now - start) / (duration * 1000));
        const v = 1 - Math.pow(1 - raw, 2); // power2.out
        entry.mesh.position.lerpVectors(fromPose.pos, toPose.pos, v);
        entry.mesh.scale.lerpVectors(fromPose.scale, toPose.scale, v);
        u.u_res.value.set(entry.mesh.scale.x, entry.mesh.scale.y);
        u.u_white.value = v;
        u.u_shade.value = 1 - v;
        u.u_sheetP.value = 1 - v;
        u.u_scrim.value = 0;
        u.u_corner.value = fromCorner + (toCorner - fromCorner) * v;
        u.u_alpha.value = 1;
        entry.mesh.rotation.y = v * Math.PI;
        onProgress?.(raw);
        if (raw < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }

  /** land a card back on the carousel after a page closes */
  landCard(slug: string, duration = 0.9): Promise<void> {
    const entry = this.cards.find((c) => c.slug === slug);
    if (!entry) return Promise.resolve();
    const toRect = (entry.el as any)._vrect ?? rectOf(entry.el);
    const toPose = this.pose(toRect);
    const sheetRect = this.sheetRect();
    const fromPose = this.pose(sheetRect);
    const u = entry.mesh.material.uniforms;
    const toRadius = this.small ? 1.5 * 10 * (this.ww / 390) : 2 * 10 * (this.ww / 1500);
    const toCorner = toRect.height ? Math.min(0.5, toRadius / toRect.height) : 0.15;

    return new Promise((resolve) => {
      const start = performance.now();
      const step = (now: number) => {
        const raw = Math.min(1, (now - start) / (duration * 1000));
        const v = 1 - Math.pow(1 - raw, 2);
        entry.mesh.position.lerpVectors(fromPose.pos, toPose.pos, v);
        entry.mesh.scale.lerpVectors(fromPose.scale, toPose.scale, v);
        u.u_res.value.set(entry.mesh.scale.x, entry.mesh.scale.y);
        u.u_white.value = 1 - v;
        u.u_shade.value = v;
        u.u_sheetP.value = v;
        u.u_corner.value = toCorner + (0.15 - toCorner) * (1 - v);
        u.u_alpha.value = 1;
        entry.mesh.rotation.y = (1 - v) * Math.PI;
        if (raw < 1) requestAnimationFrame(step);
        else {
          entry.mesh.rotation.y = 0;
          entry.flying = false;
          u.u_sheetP.value = 1;
          u.u_white.value = 0;
          resolve();
        }
      };
      requestAnimationFrame(step);
    });
  }

  /** the rect the project sheet occupies, in CSS px */
  sheetRect(): Rect {
    const rem = 10 * (this.ww / (this.small ? 390 : 1500));
    if (this.small) {
      const y = 1.5 * rem;
      const x = 2 * rem;
      return { left: x, top: y, width: this.ww - x * 2, height: this.wh - y * 2 };
    }
    const y = 2 * rem;
    const x = 5 * rem;
    return { left: x, top: y, width: this.ww - x * 2, height: this.wh - y * 2 };
  }

  showGround(on: boolean) {
    this.groundAlpha = on ? MI.alpha : 0;
    this.ground.visible = on && !this.small;
  }

  showVeil(on: boolean) {
    this.veilAlpha = on ? 1 : 0;
  }

  openHole(x: number, y: number) {
    this.holeTarget = 1;
    if (this.hole) {
      const u = (this.hole.material as THREE.ShaderMaterial).uniforms;
      u.u_center.value.set(x / this.ww, 1 - y / this.wh);
    }
  }

  closeHole() {
    this.holeTarget = 0;
  }

  showBall(on: boolean) {
    if (this.ballState.on === on) return;
    this.ballState.on = on;
    if (!on) this.ballState.seen = false;
  }

  moveBall(x: number, y: number) {
    const b = this.ballState;
    if (!b.seen) {
      b.seen = true;
      b.sx = x;
      b.sy = y;
    }
    b.x = x;
    b.y = y;
  }

  private tick(dt: number, t: number) {
    // hole progress easing
    this.holeP += (this.holeTarget - this.holeP) * Math.min(1, dt * 4.5);
    if (this.hole) {
      const u = (this.hole.material as THREE.ShaderMaterial).uniforms;
      u.u_p.value = this.holeP;
      u.u_time.value = t;
    }

    // veil
    if (this.veil) {
      const u = (this.veil.material as THREE.ShaderMaterial).uniforms;
      u.u_alpha.value += (this.veilAlpha - u.u_alpha.value) * Math.min(1, dt * 4);
    }

    // ball
    const b = this.ballState;
    if (b.seen) {
      const k = 1 - Math.exp(-7 * dt);
      b.sx += (b.x - b.sx) * k;
      b.sy += (b.y - b.sy) * k;
    }
    b.p += ((b.on ? 1 : 0) - b.p) * Math.min(1, dt * 5);
    if (this.ball) {
      const u = (this.ball.material as THREE.ShaderMaterial).uniforms;
      const dist = Math.hypot(b.x - b.sx, b.y - b.sy) / Math.max(this.ww, 1);
      const r = Math.tanh(Math.max(0, dist - 0.02) / 0.08);
      b.e = Math.max(0, r * r);
      u.u_a.value = b.p * 0.9;
      u.u_rad.value = 0.026 + b.e * 0.012;
      u.u_trail.value = b.e;
      u.u_pos.value.set(b.x / this.ww, 1 - b.y / this.wh);
      u.u_trailPos.value.set(b.sx / this.ww, 1 - b.sy / this.wh);
    }

    // decay velocity
    this.vel *= Math.exp(-4 * dt);
    this.bulge *= Math.exp(-4 * dt);
  }

  private syncGround() {
    if (!this.ground.visible) return;
    const u = this.ground.material as THREE.ShaderMaterial;
    const sheet = this.sheetCfg;
    const first = this.cards[0];
    if (!first) return;
    const r = (first.el as any)._vrect ?? rectOf(first.el);
    const p = this.pose(r);
    const a = p.pos.y - p.scale.y / 2 - sheet.H * MI.drop;
    const o = sheet.H * MI.run;
    const l = this.camera.position.z;
    const un = Math.min(l * (1 - Math.abs(a) / sheet.H) + sheet.H * MI.lip, l * 0.8);
    const c = un + o;
    const wide = sheet.W * 2 * MI.wide;
    this.ground.scale.set(wide, 1, c);
    this.ground.position.set(0, a, (un - o) / 2);
    const cell = sheet.H * MI.cell;
    u.uniforms.u_gridF.value.set(wide / cell, o / cell);
    u.uniforms.u_run.value = o;
    u.uniforms.u_alpha.value = this.groundAlpha;
    u.uniforms.u_reflLX.value = 0;

    // reflection pass — camera mirrored across the plane reflGap below the floor
    if (this.reflRT && this.groundAlpha > 0.01) {
      const m = a - sheet.H * MI.reflGap;
      this.reflCamera.fov = this.camera.fov;
      this.reflCamera.aspect = this.camera.aspect;
      this.reflCamera.near = this.camera.near;
      this.reflCamera.far = this.camera.far;
      this.reflCamera.position.set(
        this.camera.position.x,
        2 * m - this.camera.position.y,
        this.camera.position.z
      );
      this.reflCamera.rotation.copy(this.camera.rotation);
      this.reflCamera.updateProjectionMatrix();
      this.reflCamera.updateMatrixWorld();

      const groundWas = this.ground.visible;
      const veilWas = this.veil.visible;
      this.ground.visible = false;
      this.veil.visible = false;
      const prevRT = this.renderer.getRenderTarget();
      const prevAuto = this.renderer.autoClear;
      this.renderer.autoClear = true;
      this.renderer.setRenderTarget(this.reflRT);
      this.renderer.setClearColor(0x000000, 1);
      this.renderer.clear();
      this.renderer.render(this.scene, this.reflCamera);
      this.renderer.setRenderTarget(prevRT);
      this.renderer.autoClear = prevAuto;
      this.ground.visible = groundWas;
      this.veil.visible = veilWas;

      u.uniforms.u_refl.value = this.reflRT.texture;
      const vp = new THREE.Matrix4()
        .copy(this.reflCamera.projectionMatrix)
        .multiply(this.reflCamera.matrixWorldInverse);
      (u.uniforms.u_reflVP.value as THREE.Matrix4).copy(vp);
      u.uniforms.u_reflSpread.value = MI.reflSpread;
      u.uniforms.u_reflLX.value = -sheet.W * MI.reflLight;
      u.uniforms.u_reflA.value = MI.refl * this.groundAlpha;
    } else {
      u.uniforms.u_reflA.value = 0;
    }
  }

  private render() {
    this.syncGround();

    const needsHole = this.holeP > 0.001;
    const showBall = this.ballState.p > 0.01;
    this.renderer.autoClear = false;

    if (needsHole) {
      // 1) scene → RT
      this.renderer.setRenderTarget(this.sceneRT);
      this.renderer.clear(true, true, false);
      this.renderer.render(this.scene, this.camera);
      this.renderer.setRenderTarget(null);

      // 2) hole quad (opaque, covers screen)
      const hu = (this.hole.material as THREE.ShaderMaterial).uniforms;
      hu.u_scene.value = this.sceneRT.texture;
      this.hole.visible = true;
      this.renderer.clear(true, true, false);
      this.renderer.render(this.holeScene, this.camera);

      // 3) ball on top (additive, no clear)
      if (showBall) {
        this.hole.visible = false;
        this.ball.visible = true;
        this.renderer.render(this.ballScene, this.camera);
      }
      this.hole.visible = false;
      this.ball.visible = false;
    } else {
      this.renderer.clear(true, true, false);
      this.renderer.render(this.scene, this.camera);
      if (showBall) {
        this.ball.visible = true;
        this.renderer.render(this.ballScene, this.camera);
      }
      this.ball.visible = false;
    }
    this.renderer.autoClear = true;
  }

  private holeScene = new THREE.Scene();
  private ballScene = new THREE.Scene();

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.onFrame?.(dt);
    this.tick(dt, this.clock.elapsedTime);
    this.render();
  };
}

function rectOf(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

function replaceChunks(src: string) {
  return src.replace(
    "#include <chunks>",
    [ROUNDED_BOX, UV_COVER, LEAN, BULGE, SHEET, SHEET_LIGHT].join("\n")
  );
}
