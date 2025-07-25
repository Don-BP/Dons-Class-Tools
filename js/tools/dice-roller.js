// js/tools/dice-roller.js

import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.19.0/dist/cannon-es.js';
import { playSound } from '../utils.js';
import { openFileUploadModal } from '../main.js';

let defaultAspectRatio = null;
let scene, camera, renderer, world, floorMesh;
let dice = [];
const canvasContainer = document.getElementById('dice-canvas-container');
const TABLE_IMAGE_KEY = 'donDiceTableImage';

function forceResize() {
    if (!renderer || !camera || !canvasContainer) return;
    const { clientWidth, clientHeight } = canvasContainer;
    if (clientWidth === 0 || clientHeight === 0) return;
    if (!defaultAspectRatio) {
        defaultAspectRatio = clientWidth / clientHeight;
    }
    camera.aspect = defaultAspectRatio;
    camera.updateProjectionMatrix();
    renderer.setSize(clientWidth, clientHeight, false);
    const containerAspect = clientWidth / clientHeight;
    let newWidth, newHeight;
    if (containerAspect > defaultAspectRatio) {
        newHeight = clientHeight;
        newWidth = newHeight * defaultAspectRatio;
    } else {
        newWidth = clientWidth;
        newHeight = newWidth / defaultAspectRatio;
    }
    const x = (clientWidth - newWidth) / 2;
    const y = (clientHeight - newHeight) / 2;
    renderer.setViewport(x, y, newWidth, newHeight);
}

function enterFullscreen() {
    setTimeout(forceResize, 50);
}

function exitFullscreen() {
    forceResize();
}

function init() {
    const rollBtn = document.getElementById('dr-roll-btn');
    const diceCountSelect = document.getElementById('dr-dice-count');
    const gravitySelect = document.getElementById('dr-gravity-level'); 
    const resultPopup = document.getElementById('dice-result-popup');
    const resultTotalDisplay = document.getElementById('dice-result-total');
    const resultCloseBtn = document.getElementById('dice-result-close-btn');
    const tableImageUpload = document.getElementById('dr-table-image-upload');
    const tableImageUploadLabel = document.querySelector('label[for="dr-table-image-upload"]');
    const removeTableImageBtn = document.getElementById('dr-remove-table-image-btn');

    let isRolling = false;
    let settleTimeout, failsafeTimeout;

    const DICE_SCALE = 4.0; 
    const GRAVITY_LEVELS = { '1': -90, '2': -50, '3': -20, '4': -5 };
    const FAILSAFE_TIMEOUTS = { '1': 2500, '2': 4000, '3': 6000, '4': 8000 };

    function setupScene() {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        canvasContainer.appendChild(renderer.domElement);
        renderer.domElement.style.cssText = 'width: 100%; height: 100%; display: block;';

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(45, canvasContainer.clientWidth / canvasContainer.clientHeight, 0.1, 100);
        camera.position.set(0, 18, 18);
        camera.lookAt(0, 0, 0);

        scene.add(new THREE.AmbientLight(0xffffff, 0.7));
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
        directionalLight.position.set(5, 10, 7.5);
        directionalLight.castShadow = true;
        scene.add(directionalLight);

        world = new CANNON.World({ gravity: new CANNON.Vec3(0, GRAVITY_LEVELS[gravitySelect.value] || -90, 0) });

        const floorBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
        floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        world.addBody(floorBody);
        
        const initialAspectRatio = canvasContainer.clientWidth / canvasContainer.clientHeight || 1;
        const sceneDepth = 20; 
        const sceneWidth = sceneDepth * initialAspectRatio;

        floorMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(100, 100), 
            new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.7 })
        );
        floorMesh.rotation.x = -Math.PI / 2;
        floorMesh.receiveShadow = true;
        floorMesh.scale.x = initialAspectRatio;
        scene.add(floorMesh);

        const grid = new THREE.GridHelper(40, 40, 0x000000, 0x000000);
        grid.scale.x = initialAspectRatio;
        grid.material.opacity = 0.2;
        grid.material.transparent = true;
        scene.add(grid);
        
        const wallShapes = [
            { pos: [0, 0, -(sceneDepth / 2)], rot: [0, 0, 0] },
            { pos: [0, 0, sceneDepth / 2], rot: [0, Math.PI, 0] },
            { pos: [-(sceneWidth / 2), 0, 0], rot: [0, Math.PI / 2, 0] },
            { pos: [sceneWidth / 2, 0, 0], rot: [0, -Math.PI / 2, 0] }
        ];
        wallShapes.forEach(ws => {
            const wall = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
            wall.position.set(...ws.pos);
            wall.quaternion.setFromEuler(...ws.rot);
            world.addBody(wall);
        });
        
        loadTableImage();
        forceResize();
    }
    
    function updateGravity() {
        if (world && gravitySelect) {
            const newGravityY = GRAVITY_LEVELS[gravitySelect.value];
            if (newGravityY) world.gravity.y = newGravityY;
        }
    }

    function createFaceTexture(text, size, bgColor) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = size; canvas.height = size;
        context.fillStyle = bgColor; context.fillRect(0, 0, size, size);
        context.font = `bold ${size * 0.7}px Arial`;
        context.fillStyle = 'black'; context.textAlign = 'center'; context.textBaseline = 'middle';
        context.fillText(text, size / 2, size / 2 + size * 0.05);
        return new THREE.CanvasTexture(canvas);
    }
    
    function createDie() {
        const geometry = new THREE.BoxGeometry(DICE_SCALE, DICE_SCALE, DICE_SCALE);
        const dieColor = new THREE.Color().setHSL(Math.random(), 0.8, 0.6).getStyle();
        const values = [6, 1, 2, 5, 3, 4];
        const materials = values.map(value => new THREE.MeshStandardMaterial({
            map: createFaceTexture(value, 128, dieColor),
            color: 0xffffff, roughness: 0.2, metalness: 0.1
        }));
        const mesh = new THREE.Mesh(geometry, materials);
        mesh.castShadow = true;
        const body = new CANNON.Body({ mass: 1, shape: new CANNON.Box(new CANNON.Vec3(DICE_SCALE/2, DICE_SCALE/2, DICE_SCALE/2)) });
        body.allowSleep = true; body.sleepSpeedLimit = 0.2; body.sleepTimeLimit = 0.5;
        return { mesh, body, values };
    }
    
    function applyTableTexture(dataUrl) {
        new THREE.TextureLoader().load(dataUrl, (texture) => {
            texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(1, 1);
            floorMesh.material.map = texture;
            floorMesh.material.color.set(0xffffff);
            floorMesh.material.needsUpdate = true;
        });
    }

    function removeTableTexture() {
        floorMesh.material.map = null;
        floorMesh.material.color.set(0xcccccc);
        floorMesh.material.needsUpdate = true;
    }

    function loadTableImage() {
        const savedImage = localStorage.getItem(TABLE_IMAGE_KEY);
        if (savedImage) {
            applyTableTexture(savedImage);
            removeTableImageBtn.classList.remove('hidden');
        }
    }

    function rollTheDice() {
        if (isRolling) return;
        isRolling = true; rollBtn.disabled = true; resultPopup.classList.add('hidden');
        dice.forEach(d => { scene.remove(d.mesh); world.removeBody(d.body); });
        dice = [];
        for (let i = 0; i < parseInt(diceCountSelect.value); i++) {
            const die = createDie();
            die.body.position.set(Math.random() * 6 - 3, 5 + i * 4, Math.random() * 6 - 3);
            die.body.quaternion.setFromEuler(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);
            die.body.angularVelocity.set(Math.random() * 20 - 10, Math.random() * 20 - 10, Math.random() * 20 - 10);
            dice.push(die); scene.add(die.mesh); world.addBody(die.body);
        }
        playSound('assets/sounds/spin_start.mp3');
        clearTimeout(settleTimeout); clearTimeout(failsafeTimeout);
        checkIfSettled();
        failsafeTimeout = setTimeout(showResult, FAILSAFE_TIMEOUTS[gravitySelect.value] || 2500);
    }
    
    function checkIfSettled() {
        if (!isRolling) return;
        if (dice.length > 0 && dice.every(d => d.body.velocity.lengthSquared() < 0.01 && d.body.angularVelocity.lengthSquared() < 0.01)) {
            showResult();
        } else {
            settleTimeout = setTimeout(checkIfSettled, 100);
        }
    }
    
    function showResult() {
        if (!isRolling) return; 
        isRolling = false; rollBtn.disabled = false;
        clearTimeout(settleTimeout); clearTimeout(failsafeTimeout);
        const total = dice.reduce((sum, die) => sum + getD6Result(die), 0);
        resultTotalDisplay.textContent = total;
        resultPopup.classList.remove('hidden');
        playSound('assets/sounds/winner_reveal.mp3');
    }

    function getD6Result(die) {
        const up = new CANNON.Vec3(0, 1, 0); let maxDot = -Infinity; let topFaceIndex = -1;
        const localAxes = [ new CANNON.Vec3(1,0,0), new CANNON.Vec3(-1,0,0), new CANNON.Vec3(0,1,0), new CANNON.Vec3(0,-1,0), new CANNON.Vec3(0,0,1), new CANNON.Vec3(0,0,-1) ];
        for (let i = 0; i < localAxes.length; i++) {
            const worldAxis = die.body.quaternion.vmult(localAxes[i]);
            const dot = worldAxis.dot(up);
            if (dot > maxDot) { maxDot = dot; topFaceIndex = i; }
        }
        return die.values[topFaceIndex];
    }
    
    function animate() {
        requestAnimationFrame(animate);
        world.step(1 / 60);
        dice.forEach(d => { d.mesh.position.copy(d.body.position); d.mesh.quaternion.copy(d.body.quaternion); });
        renderer.render(scene, camera);
    }
    
    rollBtn.addEventListener('click', rollTheDice);
    resultCloseBtn.addEventListener('click', () => resultPopup.classList.add('hidden'));
    gravitySelect.addEventListener('change', updateGravity);

    // ** THE FIX **: Use the centralized modal.
    if (tableImageUploadLabel) {
        tableImageUploadLabel.addEventListener('click', (e) => {
            e.preventDefault();
            openFileUploadModal('dice-roller-tool', 'dr-table-image-upload', 'Upload Table Image');
        });
    }

    tableImageUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const dataUrl = event.target.result;
                localStorage.setItem(TABLE_IMAGE_KEY, dataUrl);
                applyTableTexture(dataUrl);
                removeTableImageBtn.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
            e.target.value = null;
        }
    });
    
    removeTableImageBtn.addEventListener('click', () => {
        localStorage.removeItem(TABLE_IMAGE_KEY);
        removeTableTexture();
        removeTableImageBtn.classList.add('hidden');
    });

    const resizeObserver = new ResizeObserver(forceResize);
    resizeObserver.observe(canvasContainer);

    setupScene();
    animate();
}

export const DiceRoller = { init, enterFullscreen, exitFullscreen };