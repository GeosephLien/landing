import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

const THUMBNAIL_GRADIENTS = [
  ['#4a8dff', '#9d6bff', '#ff8a63'],
  ['#18b7a0', '#4b7eff', '#9f6dff'],
  ['#ff7b7b', '#ffb36b', '#6b8dff'],
  ['#11b5d8', '#2c7ef0', '#9b45f7'],
  ['#f25f8b', '#f59a58', '#ffd166']
];

function getGradientForLabel(label) {
  const value = String(label || 'avatar');
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }

  return THUMBNAIL_GRADIENTS[Math.abs(hash) % THUMBNAIL_GRADIENTS.length];
}

function getAvatarFacingRotation(vrm) {
  const metaVersion = String(vrm?.meta?.metaVersion ?? '').trim();
  return metaVersion.startsWith('1') ? 0 : Math.PI;
}

function createGradientBackground(context, size, label) {
  const [startColor, midColor, endColor] = getGradientForLabel(label);
  const gradient = context.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, startColor);
  gradient.addColorStop(0.52, midColor);
  gradient.addColorStop(1, endColor);
  return gradient;
}

async function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error('Unable to create a thumbnail image.'));
    }, 'image/png');
  });
}

async function loadVrm(url) {
  const loader = new GLTFLoader();
  loader.crossOrigin = 'anonymous';
  loader.register((parser) => new VRMLoaderPlugin(parser));
  const gltf = await loader.loadAsync(url);
  const vrm = gltf.userData.vrm;
  if (!vrm) {
    throw new Error('The selected file is not a VRM.');
  }
  return { gltf, vrm };
}

async function createFallbackThumbnailBlob(label) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');

  context.fillStyle = createGradientBackground(context, size, label);
  context.fillRect(0, 0, size, size);

  context.fillStyle = 'rgba(255, 255, 255, 0.14)';
  context.beginPath();
  context.arc(size / 2, size / 2, size * 0.28, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = 'rgba(255, 255, 255, 0.88)';
  context.lineWidth = 8;
  context.beginPath();
  context.arc(size / 2, size * 0.43, size * 0.11, 0, Math.PI * 2);
  context.stroke();

  context.beginPath();
  context.arc(size / 2, size * 0.66, size * 0.2, Math.PI, 0, false);
  context.stroke();

  return canvasToBlob(canvas);
}

async function createRenderedThumbnailBlob(url, label) {
  const thumbnailSize = 256;
  const renderCanvas = document.createElement('canvas');
  const outputCanvas = document.createElement('canvas');
  renderCanvas.width = thumbnailSize;
  renderCanvas.height = thumbnailSize;
  outputCanvas.width = thumbnailSize;
  outputCanvas.height = thumbnailSize;

  const renderer = new THREE.WebGLRenderer({
    canvas: renderCanvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(1.35);
  renderer.setSize(thumbnailSize, thumbnailSize, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(22, 1, 0.01, 20);

  try {
    const { gltf, vrm } = await loadVrm(url);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xbcabe0, 3.6));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.15);
    directionalLight.position.set(1.25, 1.8, 2.4);
    scene.add(directionalLight);

    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    VRMUtils.removeUnnecessaryJoints(gltf.scene);
    vrm.scene.rotation.y = getAvatarFacingRotation(vrm);
    scene.add(vrm.scene);
    vrm.update(0);
    vrm.scene.updateMatrixWorld(true);

    const bounds = new THREE.Box3().setFromObject(vrm.scene);
    const size = bounds.getSize(new THREE.Vector3());
    const fallbackTarget = bounds.getCenter(new THREE.Vector3()).add(new THREE.Vector3(0, size.y * 0.18, 0));
    const headBone = vrm.humanoid?.getNormalizedBoneNode('head') || vrm.humanoid?.getRawBoneNode('head') || null;
    const target = headBone ? headBone.getWorldPosition(new THREE.Vector3()) : fallbackTarget;
    target.y += 0.015;

    const faceSpan = Math.max(size.x * 0.34, size.y * 0.24, 0.24);
    const distance = Math.max(faceSpan / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))), 0.4) + size.z * 0.18;
    camera.position.copy(target).add(new THREE.Vector3(0, 0, distance));
    camera.lookAt(target);
    camera.far = Math.max(distance + size.z * 3, 10);
    camera.updateProjectionMatrix();

    renderer.render(scene, camera);

    const outputContext = outputCanvas.getContext('2d');
    outputContext.fillStyle = createGradientBackground(outputContext, thumbnailSize, label);
    outputContext.fillRect(0, 0, thumbnailSize, thumbnailSize);
    outputContext.drawImage(renderCanvas, 0, 0, thumbnailSize, thumbnailSize);

    scene.remove(vrm.scene);
    VRMUtils.deepDispose(vrm.scene);

    return canvasToBlob(outputCanvas);
  } finally {
    renderer.dispose();
    if (typeof renderer.forceContextLoss === 'function') {
      renderer.forceContextLoss();
    }
  }
}

export async function createAvatarThumbnailBlob(vrmSource, options = {}) {
  const label = options && options.label ? String(options.label) : 'avatar';
  let objectUrl = '';
  const sourceUrl = vrmSource instanceof Blob ? (objectUrl = URL.createObjectURL(vrmSource)) : String(vrmSource || '');

  try {
    if (!sourceUrl) {
      throw new Error('No avatar source is available for thumbnail generation.');
    }

    try {
      return await createRenderedThumbnailBlob(sourceUrl, label);
    } catch (error) {
      console.warn('Falling back to a simplified thumbnail.', error);
      return await createFallbackThumbnailBlob(label);
    }
  } finally {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
}
