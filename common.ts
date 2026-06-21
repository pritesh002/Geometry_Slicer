import { vec3 } from "gl-matrix";

export const vertexAttributeEnum = Object.freeze({
    AMC_ATTRIBUTE_POSITION: 0,
    AMC_ATTRIBUTE_COLOR: 1,
    AMC_ATTRIBUTE_NORMAL: 2,
    AMC_ATTRIBUTE_TEXCOORD: 3
});

export let canvas: HTMLCanvasElement;
export let gl: WebGL2RenderingContext;

export const cameraPos = vec3.fromValues(0.0, 0.0, 3.0);
export const cameraFront = vec3.fromValues(0.0, 0.0, -1.0);
export const cameraUp = vec3.fromValues(0.0, 1.0, 0.0);
export const modelWorldPosition = vec3.fromValues(0.0, 0.0, -3.0);

export function setCanvas(value: HTMLCanvasElement): void {
    canvas = value;
}

export function setGL(value: WebGL2RenderingContext): void {
    gl = value;
}
