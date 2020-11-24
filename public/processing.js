const videoWidth = 480;
const videoHeight = 800;
const color = 'blue';
const lineWidth = 10;

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
        if (checkPose(keypoints)){
            location.href="public/nextpage.html";
        }
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

function checkPose(keypoints){
  var noseY = 0;
  var leftWristY = 0;
  var rightWristY = 0;
  var isHandsUp = false;
  for (let i = 0; i < keypoints.length; i++) {
    const keypoint = keypoints[i];
    if(keypoint.part == "nose"){
      noseY = keypoint.position.y;
    } else if(keypoint.part == "leftWrist"){
      leftWristY = keypoint.position.y;
    } else if(keypoint.part == "rightWrist"){
      rightWristY = keypoint.position.y;
    }
  }
  // 왼팔과 오른팔의 값이 코의 기준 값보다 크다면, 만세를 한 것으로 추정
  if (noseY > leftWristY && noseY > rightWristY){
    isHandsUp = true;
    console.log("noseY: " + noseY + " leftWristY:" + leftWristY + " rightWristY: " + rightWristY);
  }
  return isHandsUp;
}

navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
bindPage();
