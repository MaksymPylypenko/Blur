// will set to true when video can be copied to texture
var copyVideo = false;


// Slider
var radius_input = document.getElementById('radius_input');
var radius_value = document.getElementById('radius_value');

radius_input.oninput = function() {
    radius_value.value = this.value;
};


// Start
main();

function main() {
    const video = document.createElement('video');
    var url = 'video.mp4';

    var playing = false;
    var timeupdate = false;

    video.autoplay = true;
    video.muted = true;
    video.loop = true;

    // Waiting for these 2 events ensures
    // there is data in the video

    video.addEventListener('playing', function() {
        playing = true;
        checkReady();
    }, true);

    video.addEventListener('timeupdate', function() {
        timeupdate = true;
        checkReady();
    }, true);

    // Can start rendering when we know 
    // resolution of the video

    video.addEventListener('loadedmetadata', function(e) {
        setupCanvas(video); 
    }, true);

    video.src = url;
    video.play();

    function checkReady() {
        if (playing && timeupdate) {
            copyVideo = true;
        }
    }
    return video;
}


function setupCanvas(video) {
    const canvas = document.querySelector('#glcanvas');

    var image = {
      x: video.videoWidth,
      y: video.videoHeight,
    };

    // image.x/=2;
    // image.y/=2;

    canvas.width = image.x;
    canvas.height = image.y;

    // Fill the contect preserving the original ratio
    canvas.style.width = "100vw";
    canvas.style.height = 100 * image.y / image.x + "vw";
    canvas.style.maxHeight = "100vh";
    canvas.style.maxWidth = 100 * image.x / image.y + "vh";

    const gl = canvas.getContext('webgl');

    // If we don't have a GL context, give up now

    if (!gl) {
        alert('Unable to initialize WebGL. Your browser or machine may not support it.');
        return;
    }
  
    // Initialize a shader program

    const vertexSource = document.getElementById("vertex-shader").text;
    const fragmentSource = document.getElementById("fragment-shader").text;
    shaderProgram = linkShaders(gl, vertexSource, fragmentSource);  

    // Look up which attributes & uniform variables 
    // our shader program is using

    const programInfo = {
        attribLocations: {
            vertexPosition: gl.getAttribLocation(shaderProgram, 'vPosition'),
        },
        uniformLocations: {
            videoTexture: gl.getUniformLocation(shaderProgram, 'videoTexture'),
            pixelSize: gl.getUniformLocation(shaderProgram, 'pixelSize'),
            stage: gl.getUniformLocation(shaderProgram, 'stage'),
            flipY: gl.getUniformLocation(shaderProgram, 'flipY'),
        }
    };

    // Here's where we call the routine that builds all the
    // objects we'll be drawing.

    bindBuffers(gl, programInfo.attribLocations);
    gl.useProgram(shaderProgram); 
    
    // ... 
    // https://webglfundamentals.org/webgl/lessons/webgl-image-processing-continued.html
    
    // create 2 textures and attach them to framebuffers.
    var textures = [];
    var framebuffers = [];
    for (var ii = 0; ii < 2; ++ii) {
      var texture = initTexture(gl);
      textures.push(texture);
  
      // make the texture the same size as the image
      gl.texImage2D(
          gl.TEXTURE_2D, 0, gl.RGBA, image.x, image.y, 0,
          gl.RGBA, gl.UNSIGNED_BYTE, null);
  
      // Create a framebuffer
      var fbo = gl.createFramebuffer();
      framebuffers.push(fbo);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  
      // Attach a texture to it.
      gl.framebufferTexture2D(
          gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    }
          
    // ...

    function render() {

        gl.uniform2fv(programInfo.uniformLocations.pixelSize, [radius_value.value*1.0/image.x, radius_value.value*1.0/image.y]);
       
        if (copyVideo) {
            updateTexture(gl, textures[1], video);
        }

        // link framebuffer
        // link uniforms
        // draw

        // 1. image --> effect 1 --> texture 1.

         gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[0]);    
         gl.uniform1i(programInfo.uniformLocations.stage, 0);
         gl.uniform1f(programInfo.uniformLocations.flipY, 1.0);
         gl.bindTexture(gl.TEXTURE_2D, textures[1]);
         gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);


         gl.bindFramebuffer(gl.FRAMEBUFFER, null);    
         gl.uniform1i(programInfo.uniformLocations.stage, 1);
         gl.uniform1f(programInfo.uniformLocations.flipY, -1.0);
         gl.bindTexture(gl.TEXTURE_2D, textures[0]);
         gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

     
        // 2. texture 1 --> effect 2 --> texture 2.

        // 3. texture 2 --> no effects --> canvas




        
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);

}


//
// initBuffers
//
// Initialize the buffers we'll need. 
function initBuffers(gl) {

    const positions = [1.0, 1.0, -1.0, 1.0, 1.0, -1.0, -1.0, -1.0];
    const indices = [ 0,1,3,0,3,2 ];

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices), gl.STATIC_DRAW);

    return {
        position: positionBuffer,
        indices: indexBuffer,
    };
}

//
// Initialize a texture.
//
function initTexture(gl) {
  
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
 
    // Set up texture so we can render any size image and so we are
    // working with pixels.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
 
    return texture;
}

//
// copy the video texture
//
function updateTexture(gl, texture, video) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
}


//
// 
//
function bindBuffers(gl, attribLocations){

  const positions = [1.0, 1.0, -1.0, 1.0, 1.0, -1.0, -1.0, -1.0];
  const indices = [ 0,1,3,0,3,2 ];

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices), gl.STATIC_DRAW);

  // Tell WebGL how to pull out the positions from the position
  // buffer into the vertexPosition attribute
  {
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(attribLocations.vertexPosition,2,gl.FLOAT,false,0,0);
    gl.enableVertexAttribArray(attribLocations.vertexPosition);
  }

  // Tell WebGL which indices to use to index the vertices
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
}

//
// Initialize a shader program, so WebGL knows how to draw our data
//
function linkShaders(gl, vsSource, fsSource) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
    const shaderProgram = gl.createProgram();

    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
        return null;
    }     
    return shaderProgram;
}

//
// creates a shader of the given type, uploads the source and
// compiles it.
//
function loadShader(gl, type, source) {  
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}