import { MeshData } from "./ModelLoading";
import { CutManager } from "./MeshCutter";
import {
    cameraFront,
    cameraPos,
    cameraUp,
    canvas,
    gl,
    modelWorldPosition,
    setCanvas,
    setGL,
    vertexAttributeEnum
} from "./common";
import { mat4, vec3 } from "gl-matrix";

// main function
let bFullscreen = true;
let canvas_original_width: number;
let canvas_original_height: number;

//webGL related var
let shaderProgramObject: WebGLProgram | null = null;
let mvpMatrixUniform: WebGLUniformLocation | null = null;
let textureSamplerUniform: WebGLUniformLocation | null = null;
let perspectiveProjectionMatrix: mat4;

const Meshes: MeshData[] =[
    new MeshData(),
    new MeshData(),
    new MeshData(),
    new MeshData(),
    new MeshData(),
    new MeshData(),
    new MeshData(),
]

let selectedMesh: MeshData;
let meshIndex = 0;

//grid
const grid = new MeshData;

const gMeshCutter = new CutManager();

//camera related
const camEye = vec3.create();
const cameraSpeed = 0.1;
let yaw = -90.0;
let pitch = 0.0;
let lastX = 0;
let lastY = 0;

//texture object
let texture: WebGLTexture | null = null;

let gIsSliceDragging = false;
const gSliceDragStart = { x: 0, y: 0 };
const gSliceDragEnd = { x: 0, y: 0 };


let isStarted = false;


function multiplyVec3ToConstant(vec3Variable: vec3, constToMultiply: number): vec3 {
  const resultVector = vec3.create();
  resultVector[0] = vec3Variable[0] * constToMultiply;
  resultVector[1] = vec3Variable[1] * constToMultiply;
  resultVector[2] = vec3Variable[2] * constToMultiply;

  return resultVector;
}


async function main(): Promise<void>
{
    //get canvas
    const canvasElement = document.getElementById("amc");
    if (!(canvasElement instanceof HTMLCanvasElement))
    {
        throw new Error("Getting canvas failed");
    }
    setCanvas(canvasElement);
    console.log("Getting canvas succeeded\n");

    //set canvas width and height for future use
    canvas_original_width = canvas.width;
    canvas_original_height = canvas.height;

    //regsiter for keyboard events
    window.addEventListener("keydown",keyDown,false);
    window.addEventListener("mousedown", mouseDown, false);
    window.addEventListener("mouseup", mouseUp, false);
    window.addEventListener("mousemove", mouseMove, false);
    window.addEventListener("resize",resize,false);

    //initialize
    await initialize();

    resize();

    const startScreen = document.getElementById("startScreen");
    window.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            isStarted = true;
            startScreen!.style.display = "none";
            display();
        }
    });

    const resetButton = document.getElementById("resetButton");
    resetButton!.addEventListener("click", event => {
        event.stopPropagation();
        gMeshCutter.Reset();
    });
}





function keyDown_CameraController(event: KeyboardEvent): void {
    switch (event.keyCode) {

        case 119:
        case 87:
            vec3.add(cameraPos, cameraPos, multiplyVec3ToConstant(cameraFront, cameraSpeed));
            break;

        case 115:
        case 83:
             vec3.subtract(cameraPos, cameraPos, multiplyVec3ToConstant(cameraFront, cameraSpeed));
            break;

        case 97:
        case 65:
            var result = vec3.create();
            vec3.cross(result, cameraFront, cameraUp)
            vec3.normalize(result, result);
            vec3.subtract(cameraPos, cameraPos, multiplyVec3ToConstant(result, cameraSpeed));
            break;

        case 100:
        case 68:
            var result = vec3.create();
            vec3.cross(result, cameraFront, cameraUp)
            vec3.normalize(result, result);
            vec3.add(cameraPos, cameraPos, multiplyVec3ToConstant(result, cameraSpeed));
            break;

        case 90:
            var result = vec3.create();
            vec3.cross(result, cameraFront, cameraUp)
            vec3.normalize(result, result);
            vec3.cross(result,cameraFront, result)
            vec3.add(cameraPos, cameraPos, multiplyVec3ToConstant(result, cameraSpeed));
            break;
        case 88:
            var result = vec3.create();
            vec3.cross(result, cameraFront, cameraUp)
            vec3.normalize(result, result);
            vec3.cross(result,cameraFront, result)
            vec3.subtract(cameraPos, cameraPos, multiplyVec3ToConstant(result, cameraSpeed));
            break;
        case 77:
            meshIndex++
            if(meshIndex>6)
            {
                meshIndex = 0
            }
            selectedMesh = Meshes[meshIndex]
            gMeshCutter.Reset();
            break;

    }
}

function keyDown(event: KeyboardEvent): void
{
    //code
    keyDown_CameraController(event);

    switch(event.keyCode)
    {
        case 81:
        case 113:
            uninitialize();
            window.close();
            break;
        case 70:
        case 102:
            toggleFullscreen();
            break;
    }

}

function mouseMove(event: MouseEvent): void {

    if (gIsSliceDragging)
    {
        gSliceDragEnd.x = event.clientX;
        gSliceDragEnd.y = event.clientY;
    }

    if ((event.buttons & 2) !== 0)
    {
        cameraMouseMove(event.clientX, event.clientY);
    }
}

function cameraMouseMove(xpos: number, ypos: number): void
{
    var xoffset = xpos - lastX;
    var yoffset = lastY - ypos;
    lastX = xpos;
    lastY = ypos;

    var sensitivity = 0.1;
    xoffset *= sensitivity;
    yoffset *= sensitivity;

    yaw += xoffset;
    pitch += yoffset;

    if (pitch > 89.0)
        pitch = 89.0;
    if (pitch < -89.0)
        pitch = -89.0;

    var yawInRadians = yaw * Math.PI / 180.0;
    var pitchInRadians = pitch * Math.PI / 180.0;

    var direction = vec3.fromValues(Math.cos(yawInRadians) * Math.cos(pitchInRadians),Math.sin(pitchInRadians),Math.sin(yawInRadians) * Math.cos(pitchInRadians));

    vec3.normalize(cameraFront, direction);
}

function mouseDown(event: MouseEvent): void {
    if (event.button === 2)
    {
        lastX = event.clientX;
        lastY = event.clientY;
    }

    if (event.button === 0)
    {
        gIsSliceDragging = true;
        gSliceDragStart.x = event.clientX;
        gSliceDragStart.y = event.clientY;
    }
}

function mouseUp(event: MouseEvent): void {
    if (event.button === 0)
    {
        gIsSliceDragging = false;
        gSliceDragEnd.x = event.clientX;
        gSliceDragEnd.y = event.clientY;
        gMeshCutter.SliceFromDrag(selectedMesh, gSliceDragStart.x, gSliceDragStart.y, gSliceDragEnd.x, gSliceDragEnd.y);
    }
}

function toggleFullscreen(): void
{
    const fullscreen_element = document.fullscreenElement;

    //if not fullscreen
    if(fullscreen_element == null)
    {
        // void canvas.requestFullscreen();
        void document.body.requestFullscreen();
        bFullscreen = true;
    }
    else                                                //if already fullscreen
    {
        void document.exitFullscreen();

        bFullscreen = false;
    }
}

async function initialize(): Promise<void>
{
    //code
    //get gl(context) from above canvas
    const context = canvas.getContext("webgl2");
    if(context === null)
    {
        throw new Error("Getting WebGL2 context failed");
    }
    setGL(context);
    console.log("Getting WebGL2 context succeeded\n");

    //set webgl2 context's view width and view height properties
    const vertexShaderSourceCode = 
                "#version 300 es"+
                "\n"+
                "in vec4 aPosition;"+
                "in vec3 aNormal;"+
                "in vec2 aTexCoord;"+
                "uniform mat4 uModelMatrix;"+
                "uniform mat4 uMVPMatrix;"+
                "out vec2 oTexCoord;"+
                "out vec3 transformedNormal;"+
                "out vec3 fragPos;"+
                "void main(void)"+
                "{"+
                "gl_Position= uMVPMatrix*aPosition;"+
                "oTexCoord = aTexCoord;"+
                "transformedNormal = transpose(inverse(mat3(uModelMatrix))) * aNormal;"+
                "fragPos = vec3(uModelMatrix * aPosition);"+
                "}";

    const vertexShaderObject = gl.createShader(gl.VERTEX_SHADER);
    if (!vertexShaderObject) throw new Error("Could not create vertex shader");
    gl.shaderSource(vertexShaderObject,vertexShaderSourceCode);
    gl.compileShader(vertexShaderObject);

    if(gl.getShaderParameter(vertexShaderObject,gl.COMPILE_STATUS)==false)
    {
        const error = gl.getShaderInfoLog(vertexShaderObject) ?? "Unknown error";
        if(error.length>0)
        {
            const log = "Vertex Shader Compilation Error : " + error;
            alert(log);
        }
        uninitialize();
    }
    else
    {
        console.log("Vertex Shader Compiled Successfully\n");
    }

    const fragmentShaderSourceCode = 
                "#version 300 es"+
                "\n"+
                "precision highp float;"+
                "in vec2 oTexCoord;"+
                "in vec3 fragPos;"+
                "in vec3 transformedNormal;"+
                "uniform sampler2D uTextureSampler;"+
                "uniform int uKeyPressed;"+
                "out vec4 FragColor;"+
                "void main(void)"+
                "{"+
                "if(uKeyPressed==1)"+
                "{"+
                "FragColor = vec4(0.0,1.0,0.0,1.0);"+
                "}"+
                "else"+
                "{"+
                "vec3 norm = normalize(transformedNormal);"+
                "vec3 lightColor = vec3(1.0);"+
                "vec3 lightDir = normalize(vec3(0.0,5.0,3.0) - fragPos);"+
                "float diffuse = max(dot(norm, lightDir), 0.0);"+
                "FragColor = vec4(lightColor * diffuse,1.0) * texture(uTextureSampler,oTexCoord);"+
                "}"+
                "}";

    const fragmentShaderObject = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fragmentShaderObject) throw new Error("Could not create fragment shader");
    gl.shaderSource(fragmentShaderObject,fragmentShaderSourceCode); 
    gl.compileShader(fragmentShaderObject);

    if(gl.getShaderParameter(fragmentShaderObject,gl.COMPILE_STATUS)==false)
    {
        const error = gl.getShaderInfoLog(fragmentShaderObject) ?? "Unknown error";
        if(error.length>0)
        {
            const log = "Fragment Shader Compilation Error : " + error;
            alert(log);
        }
        uninitialize();
    }
    else
    {
        console.log("Fragment Shader Compiled Successfully\n");
    }

    shaderProgramObject = gl.createProgram();
    if (!shaderProgramObject) throw new Error("Could not create shader program");
    gl.attachShader(shaderProgramObject,vertexShaderObject);
    gl.attachShader(shaderProgramObject,fragmentShaderObject);

    gl.bindAttribLocation(shaderProgramObject,vertexAttributeEnum.AMC_ATTRIBUTE_POSITION,"aPosition");
    gl.bindAttribLocation(shaderProgramObject,vertexAttributeEnum.AMC_ATTRIBUTE_NORMAL,"aNormal");
    gl.bindAttribLocation(shaderProgramObject,vertexAttributeEnum.AMC_ATTRIBUTE_TEXCOORD,"aTexCoord");

    gl.linkProgram(shaderProgramObject);

    if(gl.getProgramParameter(shaderProgramObject,gl.LINK_STATUS)==false)
    {
        const error = gl.getProgramInfoLog(shaderProgramObject) ?? "Unknown error";
        if(error.length>0)
        {
            const log = "Shader Program Linking Error : " + error;
            alert(log);
        }
        uninitialize();
    }
    else
    {
        console.log("Shader Program Linked Successfully\n")
    }

    mvpMatrixUniform = gl.getUniformLocation(shaderProgramObject,"uMVPMatrix");
    textureSamplerUniform = gl.getUniformLocation(shaderProgramObject,"uTextureSampler");

    //load model
    await Meshes[0].LoadModel("assets/models/Monkey.obj")
    await Meshes[1].LoadModel("assets/models/Cube.obj")
    await Meshes[2].LoadModel("assets/models/Cone.obj")
    await Meshes[3].LoadModel("assets/models/Cylinder.obj")
    await Meshes[4].LoadModel("assets/models/Quad.obj")
    await Meshes[5].LoadModel("assets/models/Sphere.obj")
    await Meshes[6].LoadModel("assets/models/Torus.obj")

    selectedMesh = Meshes[0];

    //load grid
    await grid.LoadModel("assets/models/Grid.obj")

    //depth initialization
    gl.clearDepth(1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    //set clear color 
    gl.clearColor(0.0,0.0,0.0,1.0);

    loadGlTexture("assets/textures/templategrid_albedo.png");

    //init projtection mat
    perspectiveProjectionMatrix = mat4.create();
}

function loadGlTexture(image_src: string): void
{ 
	texture = gl.createTexture();
    if (!texture) throw new Error("Could not create texture");

    const image = new Image();
    image.src = image_src;
    image.onload = function(): void {
        gl.bindTexture(gl.TEXTURE_2D,texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.bindTexture(gl.TEXTURE_2D,null);
    };
}

function resize(): void
{
    //code
    if(canvas.height <= 0)
        canvas.height = 1;
    
    if(bFullscreen == true)
    {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    else
    {
        canvas.width = canvas_original_width;
        canvas.height = canvas_original_height;
    }

    //set viewport
    gl.viewport(0,0,canvas.width,canvas.height);

    //set perspective projection
    mat4.perspective(perspectiveProjectionMatrix,45.0 * Math.PI / 180.0,canvas.width / canvas.height,0.1,100.0);
}

function display(): void
{
    //code
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(shaderProgramObject);

    //transformation
    const modelMatrix = mat4.create();
    const viewMatrix = mat4.create();
    const modelViewProjectionMatrix = mat4.create();

    vec3.add(camEye, cameraPos, cameraFront);

    const cameraSide = vec3.create();
    vec3.cross(cameraSide, cameraFront, cameraUp);
    vec3.normalize(cameraSide, cameraSide);

    const cameraUpVector = vec3.create();
    vec3.cross(cameraUpVector, cameraSide, cameraFront);

    mat4.lookAt(viewMatrix, cameraPos, camEye, cameraUpVector);

    mat4.translate(modelMatrix, modelMatrix, modelWorldPosition);


    mat4.multiply(modelViewProjectionMatrix, viewMatrix, modelMatrix);
    mat4.multiply(modelViewProjectionMatrix,perspectiveProjectionMatrix,modelViewProjectionMatrix);
    gl.uniformMatrix4fv(mvpMatrixUniform,false,modelViewProjectionMatrix as Float32Array);

    gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.uniform1i(textureSamplerUniform, 0);

    function drawMesh(mesh: MeshData, offset: vec3): void
    {
        if (mesh.indexCount === 0)
        {
            return;
        }

        const modelPosition = vec3.create();
        vec3.copy(modelPosition, modelWorldPosition);
        vec3.add(modelPosition, modelPosition, offset);

        mat4.identity(modelMatrix);
        mat4.translate(modelMatrix, modelMatrix, modelPosition);

        gl.uniformMatrix4fv(gl.getUniformLocation(shaderProgramObject!,"uModelMatrix"),false,modelMatrix as Float32Array);

        mat4.multiply(modelViewProjectionMatrix, viewMatrix, modelMatrix);
        mat4.multiply(modelViewProjectionMatrix,perspectiveProjectionMatrix,modelViewProjectionMatrix);

        gl.uniformMatrix4fv(mvpMatrixUniform,false,modelViewProjectionMatrix as Float32Array);

        gl.bindVertexArray(mesh.vao);
        gl.drawElements(gl.TRIANGLES,mesh.indexCount,gl.UNSIGNED_INT,0);
        gl.bindVertexArray(null);
    }

    if (gMeshCutter.isSliced)
    {

        //line
        gl.uniform1i(gl.getUniformLocation(shaderProgramObject!,"uKeyPressed"),1)
        gl.bindVertexArray(gMeshCutter.guideMesh.vao);
        gl.drawElements(gl.LINES,gMeshCutter.guideMesh.indexCount,gl.UNSIGNED_INT,0);
        gl.bindVertexArray(null);

        gl.uniform1i(gl.getUniformLocation(shaderProgramObject!,"uKeyPressed"),0)

        const positiveOffset = vec3.create();
        vec3.scale(positiveOffset, gMeshCutter.planeNormal, 0.08);

        const negativeOffset = vec3.create();
        vec3.scale(negativeOffset, gMeshCutter.planeNormal, -0.08);

        drawMesh(gMeshCutter.positiveMesh, positiveOffset);
        drawMesh(gMeshCutter.negativeMesh, negativeOffset);

    }
    else
    {
        drawMesh(selectedMesh, vec3.create());
    }

    //grid
    const gridModelMatrix = mat4.create();
    const gridMVPMatrix = mat4.create();

    mat4.identity(gridModelMatrix);
    mat4.translate(gridModelMatrix, gridModelMatrix, [0.0, -1.0, -3.0]);

    mat4.multiply(gridMVPMatrix, viewMatrix, gridModelMatrix);
    mat4.multiply(gridMVPMatrix, perspectiveProjectionMatrix, gridMVPMatrix);

    gl.uniformMatrix4fv(mvpMatrixUniform, false, gridMVPMatrix as Float32Array);
    gl.bindVertexArray(grid.vao);
    gl.drawElements(gl.LINES,grid.indexCount,gl.UNSIGNED_INT,0);
    gl.bindVertexArray(null);


    gl.useProgram(null);

    update();

    //double buffering
    window.requestAnimationFrame(display);
}

function update(): void
{
    //code
}

function uninitialize(): void
{
    //code
    if(shaderProgramObject)
    {
        gl.useProgram(shaderProgramObject);
        const shaderObjects = gl.getAttachedShaders(shaderProgramObject);
        if(shaderObjects && shaderObjects.length>0)
        {
            for(let i= 0;i<shaderObjects.length;i++)
            {
                gl.detachShader(shaderProgramObject,shaderObjects[i]);
                gl.deleteShader(shaderObjects[i]);
            }
        }
        gl.useProgram(null);
        gl.deleteProgram(shaderProgramObject);
        shaderProgramObject = null;
    }

    //destroy meshes
    for (const mesh of Meshes)
    {
        mesh.destroy();
    }

    grid.destroy();

    gMeshCutter.Destroy();

    if (texture)
    {
        gl.deleteTexture(texture);
        texture = null;
    }
    
}

function degToRad(degrees: number): number
{
    return (degrees * Math.PI / 180.0 );
}

window.main = main;
