// will set to true when video can be copied to texture
var copyVideo = false;


// UI
var textureChanged = false;

var radius_input = document.getElementById('radius_input');
var radius_value = document.getElementById('radius_value');

radius_input.oninput = function() {
    radius_value.value = this.value;
};

var rounds_input = document.getElementById('rounds_input');
var rounds_value = document.getElementById('rounds_value');

rounds_input.oninput = function() {
  rounds_value.value = this.value;
};

var downscale_input = document.getElementById('downscale_input');
var downscale_value = document.getElementById('downscale_value');
var downscalePrev = downscale_value; // tracking changes, to avoid reinitializing stuff every frame

downscale_input.oninput = function() {
  downscale_value.value = this.value;
  textureChanged = true;
};

const fps_field = document.getElementById('fps');

var linearSampling_checkbox = document.getElementById('ls_checkbox');
linearSampling_checkbox.onchange = function() {
  textureChanged = true;
}


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
      processVideo(video); 
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


function processVideo(video) {

    // Performance indicator
    var elapsedTime = 0;
    var frameCount = 0;
    var lastTime = 0;

    const canvas = document.querySelector('#glcanvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Preserving the original ratio using CSS
    canvas.style.width = "100vw";
    canvas.style.height = 100 * video.videoHeight / video.videoWidth + "vw";
    canvas.style.maxHeight = "100vh";
    canvas.style.maxWidth = 100 * video.videoWidth / video.videoHeight + "vh";

    const gl = canvas.getContext('webgl');

    // If we don't have a GL context, give up now
    if (!gl) {
        alert('Unable to initialize WebGL. Your browser or machine may not support it.');
        return;
    }

    console.log(gl.getParameter(gl.VERSION));
  
    // Initialize a shader program
    const vertexSource = document.getElementById("vertex-shader").text;
    const fragmentSource = document.getElementById("fragment-shader").text;
    shaderProgram = linkShaders(gl, vertexSource, fragmentSource);  

    // Define attributes & uniform variables 
    // for our shader program
    const attributeLocations = {
      vertexPosition: gl.getAttribLocation(shaderProgram, 'vPosition'),
    }

    const uniformLocations = {
      videoTexture: gl.getUniformLocation(shaderProgram, 'videoTexture'),
      pixelSize: gl.getUniformLocation(shaderProgram, 'pixelSize'),
      stage: gl.getUniformLocation(shaderProgram, 'stage'),
      flipY: gl.getUniformLocation(shaderProgram, 'flipY'),    
      offsets: gl.getUniformLocation(shaderProgram, 'offsets'),  
      weights: gl.getUniformLocation(shaderProgram, 'weights'),  
    }
   
    // Binding buffers
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
      gl.vertexAttribPointer(attributeLocations.vertexPosition,2,gl.FLOAT,false,0,0);
      gl.enableVertexAttribArray(attributeLocations.vertexPosition);
    }
  
    // Tell WebGL which indices to use to index the vertices
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.useProgram(shaderProgram); 
    
    // Make 2 temporary framebuffers to store intermidiate results
    // Explained here: https://webglfundamentals.org/webgl/lessons/webgl-image-processing-continued.html
        
    var x = video.videoWidth/downscale_value.value;
    var y = video.videoHeight/downscale_value.value;
    var X = video.videoWidth;
    var Y = video.videoHeight;

    var originalTexture = initTexture(gl,X,Y);
    var tempTextures = [];
    var framebuffers = [];


    for (var ii = 0; ii < 2; ++ii) {
      var texture = initTexture(gl,x,y);
      tempTextures.push(texture);
        
      gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.RGBA, x, y, 0,
        gl.RGBA, gl.UNSIGNED_BYTE, null);
  
      // create a framebuffer
      var fbo = gl.createFramebuffer();
      framebuffers.push(fbo);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  
      // attach a texture to it.
      gl.framebufferTexture2D(
          gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    }
             

    function drawToFrameBuffer(frameBufferID){     
      gl.uniform1i(uniformLocations.stage, frameBufferID%2==0 ? 0:1);  
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[frameBufferID]);    
      gl.viewport(0, 0, x, y);  
      gl.uniform2fv(uniformLocations.pixelSize, [radius_value.value*1.0/x, radius_value.value*1.0/y]);
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);     
      gl.bindTexture(gl.TEXTURE_2D, tempTextures[frameBufferID]);             
    }
  
    // These produce different blurs
    var kernels = {
      linear: {
        offsets : [0.0, 1.43478, 3.34783, 5.26087, 7.17391],
        weights : [0.16819, 0.27277, 0.116901, 0.0240679, 0.00211122],
      },
      discrete: {
        offsets : [0.0, 1.0, 2.0, 3.0, 4.0],
        weights : [0.20236, 0.179044, 0.124009, 0.067234, 0.028532],
      }
    }

    gl.uniform1fv(uniformLocations.offsets, kernels.discrete.offsets);
    gl.uniform1fv(uniformLocations.weights, kernels.discrete.weights);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);  
     
    function render() {          
        if(textureChanged){
            downscalePrev=downscale_value.value;
            x = video.videoWidth/downscale_value.value;
            y = video.videoHeight/downscale_value.value;    
            gl.bindTexture(gl.TEXTURE_2D, tempTextures[0]);      
            gl.texImage2D(
              gl.TEXTURE_2D, 0, gl.RGBA, x, y, 0,
              gl.RGBA, gl.UNSIGNED_BYTE, null);
            gl.bindTexture(gl.TEXTURE_2D, tempTextures[1]);      
              gl.texImage2D(
                gl.TEXTURE_2D, 0, gl.RGBA, x, y, 0,
                gl.RGBA, gl.UNSIGNED_BYTE, null); 
            if(linearSampling_checkbox.checked){         
                gl.uniform1fv(uniformLocations.offsets, kernels.linear.offsets);
                gl.uniform1fv(uniformLocations.weights, kernels.linear.weights);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); 
            }
            else{
                gl.uniform1fv(uniformLocations.offsets, kernels.discrete.offsets);
                gl.uniform1fv(uniformLocations.weights, kernels.discrete.weights);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); 
            }
            textureChanged = false;
        }

        if (copyVideo){
    
          // 1. Update original texture
          gl.bindTexture(gl.TEXTURE_2D, originalTexture);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
        
          // 2. Ping-ponging data from framebuffer[0] to framebuffer[1] 
          gl.uniform1i(uniformLocations.flipY, 1);

          var n = (radius_value.value==0) ? 1 : rounds_value.value;

          for(var i=1; i<=n; ++i){
            if(i==n){
              drawToFrameBuffer(0);
            }
            else{
              drawToFrameBuffer(0);
              drawToFrameBuffer(1);
            }
          }      

          // 3. Drawing to canvas
          gl.uniform1i(uniformLocations.flipY, -1);
          gl.uniform1i(uniformLocations.stage, 1);
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);    
          gl.viewport(0, 0, X, Y);             
          gl.uniform2fv(uniformLocations.pixelSize, [radius_value.value*1.0/X, radius_value.value*1.0/Y]);
          gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);   
        }        
        
        // FPS
        var now = new Date().getTime();
        frameCount++;
        elapsedTime += (now - lastTime);     
        lastTime = now;     
        if(elapsedTime >= 1000) {
            fps = frameCount;
            frameCount = 0;
            elapsedTime -= 1000;     
            fps_field.innerHTML = fps;
        }

        requestAnimationFrame(render);
    }

    lastTime = new Date().getTime();
    requestAnimationFrame(render);

}


//
// Initialize a texture.
//
function initTexture(gl, width, height) {  
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); 

    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, null);
    return texture;
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