// joints dict stores bone (joint) object and controller data (for dat.GUI)
let joints = {},
    jointConstraints = {
      'Hips': { 'min_x': -5.0, 'max_x': 5.0, 'step_x': 0.1 }
    }, // jointConstraints allows a named joint's min/max/step x/y/z values set to override the default values
    defaultConstraints = {
      'min_x': -0.5,
      'max_x': 0.5,
      'step_x': 0.01,
      'min_y': -0.5,
      'max_y': 0.5,
      'step_y': 0.01,
      'min_z': -0.5,
      'max_z': 0.5,
      'step_z': 0.01
    };

// Set our main variables
let scene,
renderer,
camera,
model, // Our character
possibleAnims, // Animations found in our file
currentAnimation = 'idle_breathing', // Name of the current animation
mixer, // THREE.js animations mixer
idle, // Idle, the default state our character returns to
clock = new THREE.Clock(), // Used for anims, which run to a clock instead of frame rate
currentlyAnimating = false, // Used to check whether characters neck is being used in another anim
raycaster = new THREE.Raycaster(), // Used to detect the click on our character
loaderAnim = document.getElementById('js-loader');

let mouseControl     = false;
let animationControl = false;
let gui;

init();

function init() {
  const MODEL_PATH = '/models/Bot/ybot.glb';
  //const MODEL_PATH = '/models/Stacy/stacy_lightweight.glb';
  const canvas = document.querySelector('#c');
  const backgroundColor = 0x0f0f0f;

  // Init the scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(backgroundColor);
  scene.fog = new THREE.Fog(backgroundColor, 60, 100);

  // Init the renderer
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.setPixelRatio(window.devicePixelRatio);
  document.body.appendChild(renderer.domElement);

  // Add a camera
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);

  camera.position.z = 30;
  camera.position.x = 0;
  camera.position.y = -3;

/*
  let stacy_txt = new THREE.TextureLoader().load('/models/Stacy/stacy.jpg');
  stacy_txt.flipY = false;
  const stacy_mtl = new THREE.MeshPhongMaterial({
    map: stacy_txt,
    color: 0xffffff,
    skinning: true });
*/

  var loader = new THREE.GLTFLoader();

  loader.load(
  MODEL_PATH,
  function (gltf) {
    model = gltf.scene;
    let fileAnimations = gltf.animations;

    model.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        //o.material = stacy_mtl;
      }
      // Map bone references to joints[boneName].joint
      if (o.isBone && o.name.startsWith('mixamorig')){
        var jointName = o.name.replace('mixamorig', '');
        debug('Generating ' + jointName);
        joints[jointName] = {
          'joint': o,
          'controller': {
            'min_x': getJointConstraints(jointName, 'min_x'),
            'max_x': getJointConstraints(jointName, 'max_x'),
            'step_x': getJointConstraints(jointName, 'step_x'),
            'min_y': getJointConstraints(jointName, 'min_y'),
            'max_y': getJointConstraints(jointName, 'max_y'),
            'step_y': getJointConstraints(jointName, 'step_y'),
            'min_z': getJointConstraints(jointName, 'min_z'),
            'max_z': getJointConstraints(jointName, 'max_z'),
            'step_z': getJointConstraints(jointName, 'step_z'),
            'x': null,
            'y': null,
            'z': null
          }
        };
      }
    });

    function getJointConstraints(jointName, attribute){
      if (typeof jointConstraints[jointName] == 'undefined'){
        //debug('No joint constraints configured for ' + jointName + ' ' + attribute);
        return defaultConstraints[attribute];
      } else {
        if (typeof jointConstraints[jointName][attribute] == 'undefined'){
          //debug('No joint constraints configured for ' + jointName + ' ' + attribute);
          return defaultConstraints[attribute];
        } else {
          debug('Constraints configured for ' + jointName + ' ' + attribute);
          return jointConstraints[jointName][attribute];
        }
      }
    }

    gui = new dat.GUI();
    var Control = function(label, value){
      this[label] = value;
    }

    mControl = new Control('Follow Mouse', mouseControl);
    mc = gui.add(mControl, 'Follow Mouse');
    mc.onChange(function(value){mouseControl = value; });

    aControl = new Control('Animation', animationControl);
    ac = gui.add(aControl, 'Animation');
    ac.onChange(function(value){animationControl = value; });

    function addJointControlX(folder, name){
      joints[name].controller.x = folder.add(new Control('X', joints[name].joint.rotation.x), 'X', joints[name].joint.rotation.x).min(joints[name].controller.min_x).max(joints[name].controller.max_x).step(joints[name].controller.step_x);
      joints[name].controller.x.onChange(function(value){
        joints[name].joint.rotation.x = value;
        debug('X Change detected: ' + name);
      });
    }

    function addJointControlY(folder, name){
      joints[name].controller.y = folder.add(new Control('Y', joints[name].joint.rotation.y), 'Y', joints[name].joint.rotation.y).min(joints[name].controller.min_y).max(joints[name].controller.max_y).step(joints[name].controller.step_y);
      joints[name].controller.y.onChange(function(value){
        joints[name].joint.rotation.y = value;
        debug('Y Change detected: ' + name);
      });
    }

    function addJointControlZ(folder, name){
      joints[name].controller.z = folder.add(new Control('Z', joints[name].joint.rotation.z),'Z', joints[name].joint.rotation.z).min(joints[name].controller.min_z).max(joints[name].controller.max_z).step(joints[name].controller.step_z);
      joints[name].controller.z.onChange(function(value){
        joints[name].joint.rotation.z = value;
        debug('Z Change detected: ' + name);
      });
    }

    for (name in joints){ //{'Neck': joints['Neck'],'Spine': joints['Spine']}){//joints){
      folder = gui.addFolder(name);
      addJointControlX(folder, name);
      addJointControlY(folder, name);
      addJointControlZ(folder, name);
    }

    model.scale.set(7, 7, 7);
    model.position.y = -11;

    scene.add(model);

    loaderAnim.remove();

    mixer = new THREE.AnimationMixer(model);

    let clips = fileAnimations.filter(val => val.name !== currentAnimation);
    possibleAnims = clips.map(val => {
      let clip = THREE.AnimationClip.findByName(clips, val.name);

      clip.tracks.splice(3, 3);
      clip.tracks.splice(9, 3);

      clip = mixer.clipAction(clip);
      return clip;
    });

    let idleAnim = THREE.AnimationClip.findByName(fileAnimations, currentAnimation);

    idleAnim.tracks.splice(3, 3);
    idleAnim.tracks.splice(9, 3);

    idle = mixer.clipAction(idleAnim);
    idle.play();
  },
  undefined, // We don't need this function
  function (error) {
    console.error(error);
  });


  // Add lights
  let hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.61);
  hemiLight.position.set(0, 50, 0);
  // Add hemisphere light to scene
  scene.add(hemiLight);

  let d = 8.25;
  let dirLight = new THREE.DirectionalLight(0xffffff, 0.54);
  dirLight.position.set(-8, 12, 8);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize = new THREE.Vector2(1024, 1024);
  dirLight.shadow.camera.near = 0.1;
  dirLight.shadow.camera.far = 1500;
  dirLight.shadow.camera.left = d * -1;
  dirLight.shadow.camera.right = d;
  dirLight.shadow.camera.top = d;
  dirLight.shadow.camera.bottom = d * -1;
  // Add directional Light to scene
  scene.add(dirLight);


  // Floor
  let floorGeometry = new THREE.PlaneGeometry(5000, 5000, 1, 1);
  let floorMaterial = new THREE.MeshPhongMaterial({
    color: 0x222222, // floor color
    shininess: 0 });


  let floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -0.5 * Math.PI;
  floor.receiveShadow = true;
  floor.position.y = -11;
  scene.add(floor);

  /*
  let geometry = new THREE.SphereGeometry(8, 32, 32);
  let material = new THREE.MeshBasicMaterial({ color: 0x 9bffaf }); // 0xf2ce2e
  let sphere = new THREE.Mesh(geometry, material);

  sphere.position.z = -15;
  sphere.position.y = -2.5;
  sphere.position.x = -0.25;
  scene.add(sphere);
  */
}

function update() {
  if (mixer) {
    mixer.update(clock.getDelta());
  }

  if (resizeRendererToDisplaySize(renderer)) {
    const canvas = renderer.domElement;
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
  }

  renderer.render(scene, camera);
  requestAnimationFrame(update);
}

update();

function resizeRendererToDisplaySize(renderer) {
  const canvas = renderer.domElement;
  let width = window.innerWidth;
  let height = window.innerHeight;
  let canvasPixelWidth = canvas.width / window.devicePixelRatio;
  let canvasPixelHeight = canvas.height / window.devicePixelRatio;
  const needResize = canvasPixelWidth !== width || canvasPixelHeight !== height;
  if (needResize) {
    renderer.setSize(width, height, false);
  }
  return needResize;
}

window.addEventListener('click', e => raycast(e));
window.addEventListener('touchend', e => raycast(e, true));

function raycast(e, touch = false) {
  var mouse = {};
  if (touch) {
    mouse.x = 2 * (e.changedTouches[0].clientX / window.innerWidth) - 1;
    mouse.y = 1 - 2 * (e.changedTouches[0].clientY / window.innerHeight);
  } else {
    mouse.x = 2 * (e.clientX / window.innerWidth) - 1;
    mouse.y = 1 - 2 * (e.clientY / window.innerHeight);
  }
  // update the picking ray with the camera and mouse position
  raycaster.setFromCamera(mouse, camera);

  // calculate objects intersecting the picking ray
  var intersects = raycaster.intersectObjects(scene.children, true);

  if (intersects[0]) {
    var object = intersects[0].object;
      if (!currentlyAnimating) {
        currentlyAnimating = true;
        playOnClick();
      }
  }
}

// Get a random animation, and play it
function playOnClick() {
  if (animationControl){
    let anim = Math.floor(Math.random() * possibleAnims.length) + 0;
    playModifierAnimation(idle, 0.25, possibleAnims[anim], 0.25);
    //playModifierAnimation(idle, 0.25, nextAnimation(possibleAnims[anim]), 0.25);
  }
}


function playModifierAnimation(from, fSpeed, to, tSpeed) {
  to.setLoop(THREE.LoopOnce);
  to.reset();
  to.play();
  from.crossFadeTo(to, fSpeed, true);
  setTimeout(function () {
    from.enabled = true;
    //to.crossFadeTo(from, tSpeed, true);
    to.crossFadeTo(nextAnimation(from), tSpeed, true);
    currentlyAnimating = false;
  }, to._clip.duration * 1000 - (tSpeed + fSpeed) * 1000);
}

document.addEventListener('mousemove', function (e) {
  var mousecoords = getMousePos(e);
  if (joints.Neck && joints.Spine && mouseControl) {
    moveJoint(mousecoords, joints.Neck.joint, 50);
    joints.Neck.controller.x.setValue(joints.Neck.joint.rotation.x);

    moveJoint(mousecoords, joints.Spine.joint, 30);
    joints.Spine.controller.x.setValue(joints.Spine.joint.rotation.x);
    //console.log(mousecoords);
  }
});

function getMousePos(e) {
  return { x: e.clientX, y: e.clientY };
}

function moveJoint(mouse, joint, degreeLimit) {
  let degrees = getMouseDegrees(mouse.x, mouse.y, degreeLimit);
  joint.rotation.y = THREE.Math.degToRad(degrees.x);
  joint.rotation.x = THREE.Math.degToRad(degrees.y);
}

function getMouseDegrees(x, y, degreeLimit) {
  let dx = 0,
  dy = 0,
  xdiff,
  xPercentage,
  ydiff,
  yPercentage;

  let w = { x: window.innerWidth, y: window.innerHeight };

  // Left (Rotates neck left between 0 and -degreeLimit)
  // 1. If cursor is in the left half of screen
  if (x <= w.x / 2) {
    // 2. Get the difference between middle of screen and cursor position
    xdiff = w.x / 2 - x;
    // 3. Find the percentage of that difference (percentage toward edge of screen)
    xPercentage = xdiff / (w.x / 2) * 100;
    // 4. Convert that to a percentage of the maximum rotation we allow for the neck
    dx = degreeLimit * xPercentage / 100 * -1;
  }

  // Right (Rotates neck right between 0 and degreeLimit)
  if (x >= w.x / 2) {
    xdiff = x - w.x / 2;
    xPercentage = xdiff / (w.x / 2) * 100;
    dx = degreeLimit * xPercentage / 100;
  }
  // Up (Rotates neck up between 0 and -degreeLimit)
  if (y <= w.y / 2) {
    ydiff = w.y / 2 - y;
    yPercentage = ydiff / (w.y / 2) * 100;
    // Note that I cut degreeLimit in half when she looks up
    dy = degreeLimit * 0.5 * yPercentage / 100 * -1;
  }
  // Down (Rotates neck down between 0 and degreeLimit)
  if (y >= w.y / 2) {
    ydiff = y - w.y / 2;
    yPercentage = ydiff / (w.y / 2) * 100;
    dy = degreeLimit * yPercentage / 100;
  }
  return { x: dx, y: dy };
}

function nextAnimation(currentAnimation){
  var nextAnim = {
      'idle_to_hang': ['hang_drop']
  };
  var next = nextAnim[currentAnimation._clip.name];
  if (next) {
    if ( next instanceof list ){
      next = Math.floor(Math.random() * next.length) + 0;
    }
    let next = THREE.AnimationClip.findByName(clips, nextAnim);
    next.tracks.splice(3, 3);
    next.tracks.splice(9, 3);
    next = mixer.clipAction(clip);
    return next;
  } else {
    return idle;
  }
}

function debug(message){
  if ( typeof gui != 'undefined'){
    gui.__controllers[0].setValue(message);
  }
  //elem = document.getElementById('debug');
  //debug.innerText = debug.innerText + "\n" + message;
  console.log(message);
}
