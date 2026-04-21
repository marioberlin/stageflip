// packages/runtimes/three/src/clips/three-product-reveal.ts
// Canonical three-runtime demo: a rotating cube with directional lighting.
// Scanned by check-determinism. Rotation + camera motion are parameterised
// entirely by the `progress` + `timeSec` args fed by the host — no
// Math.random, no Date.now, no requestAnimationFrame.

import * as THREE from 'three';

import { defineThreeClip } from '../index.js';

/** Canonical three-runtime demo clip. */
export const threeProductReveal = defineThreeClip({
  kind: 'three-product-reveal',
  setup: ({ container, width, height }) => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f14);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 3.5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(1); // deterministic across devices; don't read window.devicePixelRatio
    container.appendChild(renderer.domElement);

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({
      color: 0xff0080,
      roughness: 0.45,
      metalness: 0.1,
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
    keyLight.position.set(3, 4, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x88bbff, 0.5);
    fillLight.position.set(-4, 1, -2);
    scene.add(fillLight);

    const ambient = new THREE.AmbientLight(0xffffff, 0.25);
    scene.add(ambient);

    return {
      render({ progress }) {
        mesh.rotation.y = progress * Math.PI * 2;
        mesh.rotation.x = progress * Math.PI * 0.5;
        renderer.render(scene, camera);
      },
      dispose() {
        geometry.dispose();
        material.dispose();
        renderer.dispose();
        const dom = renderer.domElement;
        const parent = dom.parentElement;
        if (parent !== null) {
          parent.removeChild(dom);
        }
      },
    };
  },
});
