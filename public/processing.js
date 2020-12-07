const videoWidth = 720;
const videoHeight = 1280;
const color = 'red';
const lineWidth = 8;

async function setupCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Browser API navigator.mediaDevices.getUserMedia not available');
  }

  navigator.mediaDevices.enumerateDevices()
    .then(devices => {
      console.log(JSON.stringify(devices, undefined, 2));
    });

  const video = document.getElementById('vid');
  video.height = videoHeight;
  video.width = videoWidth;

  const stream = await navigator.mediaDevices.getUserMedia({
    'audio': false,
    'video': {
      width: videoWidth,
      height: videoHeight,
    },
  });
  video.srcObject = stream;

  return new Promise((resolve) => {
    video.onloadedmetadata = () => {
      resolve(video);
    };
  });
}

async function loadVideo() {
  const video = await setupCamera();
  video.play();

  return video;
}

function detectPoseInRealTime(video, net) {
  const canvas = document.getElementById('cvs');
  canvas.width = videoWidth;
  canvas.height = videoHeight;
  const ctx = canvas.getContext('2d');
  const flipHorizontal = false;

  async function poseDetectionFrame() {
    const imageScaleFactor = 0.5;
    const outputStride = 16;
    const maxPoseDetections = 2;
    const minPoseConfidence = 0.15;
    const minPartConfidence = 0.1;

    let msg = document.getElementById('msg');
    let poses = [];
    poses = await net.estimateMultiplePoses(
        video, imageScaleFactor, flipHorizontal, outputStride, maxPoseDetections
    );

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    poses.forEach(({score, keypoints}) => {
      if (score >= minPoseConfidence) {
        drawKeypoints(keypoints, minPartConfidence, ctx);
        drawSkeleton(keypoints, minPartConfidence, ctx);
        scrollToPose(keypoints);
      }
    });
    requestAnimationFrame(poseDetectionFrame);
  }
  poseDetectionFrame();
}

async function bindPage() {
  const net = await posenet.load();
  let video;
  try {
    video = await loadVideo();
  } catch (e) {
    let info = document.getElementById('info');
    info.textContent = 'this browser does not support video capture,' +
        'or this device does not have a camera. [' + e.name + ':' + e.massage + ']';
    info.style.display = 'block';
    throw e;
  }
  detectPoseInRealTime(video, net);
}

function drawKeypoints(keypoints, minConfidence, ctx, scale = 1) {
  for (let i = 0; i < keypoints.length; i++) {
    const keypoint = keypoints[i];
    if (keypoint.score < minConfidence) {
      continue;
    }
    const {y, x} = keypoint.position;
    drawPoint(ctx, y * scale, x * scale, 3, color);
  }
}

function drawPoint(ctx, y, x, r, color) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawSkeleton(keypoints, minConfidence, ctx, scale = 1) {
  const adjacentKeyPoints = posenet.getAdjacentKeyPoints(
    keypoints, minConfidence);
  adjacentKeyPoints.forEach((keypoints) => {
    drawSegment(toTuple(keypoints[0].position),
      toTuple(keypoints[1].position), color, scale, ctx);
  });
}

function drawSegment([ay, ax], [by, bx], color, scale, ctx) {
  ctx.beginPath();
  ctx.moveTo(ax * scale, ay * scale);
  ctx.lineTo(bx * scale, by * scale);
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function toTuple({y, x}) {
  return [y, x];
}

function scrollToPose(keypoints){
  let leftWristY = 0;
  let rightWristY = 0;
  let leftShoulder = 0;
  let rightShoulder = 0;
  let debugFlag = true;
  for (let i = 0; i < keypoints.length; i++) {
    const keypoint = keypoints[i];
    if (keypoint.part == "leftWrist") {
      leftWristY = keypoint.position.y;
    } else if(keypoint.part == "rightWrist") {
      rightWristY = keypoint.position.y;
    } else if(keypoint.part == "leftShoulder") {
      leftShoulder = keypoint.position.y;
    } else if(keypoint.part == "rightShoulder") {
      rightShoulder = keypoint.position.y;
    }
  }

  /* 손목이 카메라 영역에서 벗어나있지 않아야함(Scroll Down) */
  /* (1) 손목의 높이가 어깨의 높이보다 50가량 낮아야함
   * (2) 손목은 카메라에 나와있어야함. (1280 이상으로 넘어갔다는 것은 뷰파인더 범위 안에 없음)
   * (3) 손목은 어깨의 높이보단 약간 낮게 있어야하며, 가슴부위보단 높게 있어야함.
   */
  if ((leftWristY < (leftShoulder + 50) && leftWristY < videoHeight  &&
      (leftWristY >= 550 && leftWristY <= (leftShoulder + 150))) ||
        (rightWristY < (leftShoulder + 50) && rightWristY < videoHeight &&
          (rightWristY >= 550 && rightWristY <= (rightShoulder + 150)))) {

    let scrollPosition = window.scrollY || document.documentElement.scrollTop;
    window.scrollTo({top: scrollPosition + 20, left:0, behaviour: 'auto'});

    if (debugFlag) {
      console.log("leftWristY: " + leftWristY + " leftShoulder:" + leftShoulder);
      console.log("rightWristY: " + rightWristY + " rightShoulder:" + rightShoulder);
      console.log("left scroll");
    }
  }

  /* 손목이 카메라 영역에서 벗어나있지 않아야함(Scroll Up) */
  /* (1) 손목의 높이가 어깨의 높이보다 50 가량 낮아야함
   * (2) 손목은 카메라에 나와있어야함. (1280 이상으로 넘어갔다는 것은 뷰파인더 범위 안에 없음)
   * (3) 손목은 어깨의 높이보단 약간 낮게 있어야하며, 가슴부위보단 높게 있어야함.
   */
  if ((leftWristY > (leftShoulder - 50) && leftWristY < videoHeight &&
      (leftWristY >= 550 && leftWristY <= (leftShoulder + 150))) ||
        (rightWristY > (rightShoulder - 50) && rightWristY < videoHeight &&
          (rightWristY >= 550 && rightWristY <= (rightShoulder + 150)))) {

    let scrollPosition = window.scrollY || document.documentElement.scrollTop;
    window.scrollTo({top: scrollPosition - 20, left:0, behaviour: 'auto'});
    if (debugFlag) {
      console.log("leftWristY: " + leftWristY + " leftShoulder:" + leftShoulder);
      console.log("rightWristY: " + rightWristY + " rightShoulder:" + rightShoulder);
      console.log("right scroll");
    }
  }
}

navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
bindPage();
