# Blur
Real time gaussian blur in webgl.
 
# Optimizations
 
## Vertical blur --> Horizontal blur 
- doing vertical and horizontal blurs in a sequence is equivalent to a regular blur.
- texture lookups (for each fragment) are reduced from 9x9 to 9*2.
- no loss of quality.
 
## Multiple rounds 
- alternative to increasing the kernel size. 
- 2 rounds of 9x9 is equivalent to a 36x36 gaussian blur.
- adds flexibility
 
## Downscaling
- less pixels --> dramatic increase in computation --> can do more rounds
- has small overhead.
- may result in visual artifacts, especially when there is lots of movement.
 
## Linear sampling
- approximating a larger kernel (e.g 8x8 --> 17x17) by using bilinear filtering.
- some work is delegated to the hardware.


# Resources used:
* https://rastergrid.com/blog/2010/09/efficient-gaussian-blur-with-linear-sampling/
* https://webglfundamentals.org/webgl/lessons/webgl-image-processing-continued.html
* https://venturebeat.com/2017/07/13/an-investigation-of-fast-real-time-gpu-based-image-blur-algorithms/
* https://gamedev.stackexchange.com/questions/27474/optimizing-gaussian-blur-with-linear-filtering