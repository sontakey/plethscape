import * as THREE from "three";

/** A small head/neck-only view of the skin for load-time fitting and occlusion. */
export function upperSkinGeometry(source: THREE.BufferGeometry, minimumY = 3) {
  const geometry = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(source.attributes))
    geometry.setAttribute(name, attribute);
  const p = source.getAttribute("position"),
    index = source.getIndex();
  const indices: number[] = [];
  for (let i = 0; i < (index?.count ?? p.count); i += 3) {
    const a = index ? index.getX(i) : i,
      b = index ? index.getX(i + 1) : i + 1,
      c = index ? index.getX(i + 2) : i + 2;
    if (Math.max(p.getY(a), p.getY(b), p.getY(c)) > minimumY)
      indices.push(a, b, c);
  }
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function fitWearablesToSkin(
  skin: THREE.Mesh,
  temple: THREE.Group,
  neck: THREE.Group,
  templeOrigin: THREE.Vector3,
) {
  const ray = new THREE.Raycaster();
  // Horizontal triangle bins keep fitting local: each ray visits a narrow
  // slice, not every triangle in the head and neck. Discard these CPU-only
  // meshes when fitting finishes.
  const bins = new Map<number, number[]>(),
    slices = new Map<string, THREE.Mesh>();
  const skinPositions = skin.geometry.getAttribute("position"),
    skinIndices = skin.geometry.getIndex()!;
  const step = 0.025;
  for (let i = 0; i < skinIndices.count; i += 3) {
    const a = skinIndices.getX(i),
      b = skinIndices.getX(i + 1),
      c = skinIndices.getX(i + 2);
    const low = Math.floor(
      Math.min(
        skinPositions.getY(a),
        skinPositions.getY(b),
        skinPositions.getY(c),
      ) / step,
    );
    const high = Math.floor(
      Math.max(
        skinPositions.getY(a),
        skinPositions.getY(b),
        skinPositions.getY(c),
      ) / step,
    );
    for (let row = low; row <= high; row++) {
      const list = bins.get(row) ?? [];
      list.push(a, b, c);
      bins.set(row, list);
    }
  }
  const intersect = (height: number, neighbors = 0) => {
    const row = Math.floor(height / step),
      key = `${row}:${neighbors}`;
    let slice = slices.get(key);
    if (!slice) {
      const geometry = new THREE.BufferGeometry();
      for (const [name, attribute] of Object.entries(skin.geometry.attributes))
        geometry.setAttribute(name, attribute);
      const indices = [];
      for (let k = row - neighbors; k <= row + neighbors; k++)
        indices.push(...(bins.get(k) ?? []));
      geometry.setIndex(indices);
      geometry.boundingSphere = skin.geometry.boundingSphere;
      geometry.boundingBox = skin.geometry.boundingBox;
      slice = new THREE.Mesh(geometry, skin.material);
      slice.matrixWorld.copy(skin.matrixWorld);
      slices.set(key, slice);
    }
    return ray.intersectObject(slice, false)[0];
  };
  function fitPatch(
    device: THREE.Group,
    center: THREE.Vector3,
    direction: THREE.Vector3,
    clearance: number,
    tilt = 0,
  ) {
    direction.normalize();
    ray.set(
      center.clone().addScaledVector(direction, 0.5),
      direction.clone().negate(),
    );
    const hit = intersect(center.y, 1);
    if (!hit) throw new Error("Sensor patch could not be fitted to the skin");
    const normal = (hit.normal ?? hit.face!.normal).clone().normalize();
    if (normal.dot(direction) < 0) normal.negate();
    const right = new THREE.Vector3(0, 1, 0).cross(normal).normalize();
    right.applyAxisAngle(normal, tilt);
    const up = normal.clone().cross(right).normalize();
    const orientation = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(right, up, normal),
    );
    const anchor = hit.point.clone();
    const cache = new Map<string, number>();
    device.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const p = object.geometry.getAttribute("position");
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i),
          y = p.getY(i),
          z = p.getZ(i),
          // Millimeter cells preserve the wearable's surface contour while
          // avoiding redundant full-mesh raycasts for densely tessellated faces.
          key = `${x.toFixed(3)},${y.toFixed(3)}`;
        let depth = cache.get(key);
        if (depth === undefined) {
          const base = anchor
            .clone()
            .addScaledVector(right, x)
            .addScaledVector(up, y);
          ray.set(
            base.clone().addScaledVector(normal, 0.12),
            normal.clone().negate(),
          );
          // A tilted surface normal can cross several height bins along this ray.
          const contact = intersect(base.y, 5);
          if (!contact) throw new Error("Sensor patch edge missed the skin");
          depth = contact.point.sub(base).dot(normal);
          cache.set(key, depth);
        }
        p.setXYZ(i, x, y, depth + z + clearance);
      }
      p.needsUpdate = true;
      object.geometry.computeVertexNormals();
      object.geometry.computeBoundingBox();
      object.geometry.computeBoundingSphere();
    });
    return { position: anchor, quaternion: orientation };
  }
  try {
    const templeFit = fitPatch(
      temple,
      templeOrigin,
      new THREE.Vector3(0.84, 0, 0.54),
      0.0036,
      -Math.PI / 7 + Math.PI / 2,
    );
    const neckFit = fitPatch(
      neck,
      new THREE.Vector3(0, 3.145, -0.055),
      new THREE.Vector3(0.82, 0, 0.57),
      0.0028,
    );
    return { temple: templeFit, neck: neckFit };
  } finally {
    slices.forEach((mesh) => mesh.geometry.dispose());
  }
}
