"use strict";

import { MeshData, type MeshVertex } from "./ModelLoading";
import {
    cameraFront,
    cameraPos,
    cameraUp,
    canvas,
    modelWorldPosition
} from "./common";
import { vec3 } from "gl-matrix";

const PositiveSide = 1;
const NegativeSide = -1;
const PlaneEpsilon = 0.00001;
const MinDragDistanceSq = 64.0;
const MinPlaneNormalLength = 0.001;

function planeDistance(vertex: MeshVertex, planePoint: vec3, planeNormal: vec3): number
{
    const difference = vec3.create();
    vec3.subtract(difference, vertex.position, planePoint);
    return vec3.dot(difference, planeNormal);
}

function isInsideSide(distance: number, side: number): boolean
{
    return distance * side >= -PlaneEpsilon;
}

function appendPolygonAsTriangles(
    polygon: MeshVertex[],
    outVertices: MeshVertex[],
    outIndices: number[]
): void
{
    if (polygon.length < 3)
    {
        return;
    }

    const baseIndex = outVertices.length;
    outVertices.push(...polygon);

    for (let i = 1; i + 1 < polygon.length; ++i)
    {
        outIndices.push(baseIndex);
        outIndices.push(baseIndex + i);
        outIndices.push(baseIndex + i + 1);
    }
}

function clipTriangleToSide(
    triangle: MeshVertex[],
    planePoint: vec3,
    planeNormal: vec3,
    side: number
): MeshVertex[]
{
    const output = [];

    for (let i = 0; i < 3; ++i)
    {
        const current = triangle[i];
        const currentDistance = planeDistance(current, planePoint, planeNormal);
        const currentInside = isInsideSide(currentDistance, side);

        if (currentInside)
        {
            output.push(current);
        }
    }

    return output;
}

function appendClippedTriangle(
    triangle: MeshVertex[],
    planePoint: vec3,
    planeNormal: vec3,
    side: number,
    outVertices: MeshVertex[],
    outIndices: number[]
): void
{
    appendPolygonAsTriangles(
        clipTriangleToSide(triangle, planePoint, planeNormal, side),
        outVertices,
        outIndices
    );
}

export class CutManager
{
    positiveMesh: MeshData;
    negativeMesh: MeshData;
    guideMesh: MeshData;
    isSliced: boolean;
    showGuide: boolean;
    planeNormal: vec3;
    planePoint: vec3;

    constructor()
    {
        this.positiveMesh = new MeshData();
        this.negativeMesh = new MeshData();
        this.guideMesh = new MeshData();
        this.isSliced = false;
        this.showGuide = false;
        this.planeNormal = vec3.fromValues(1.0, 0.0, 0.0);
        this.planePoint = vec3.fromValues(0.0, 0.0, 0.0);
    }

    SliceFromDrag(sourceMesh: MeshData,startX: number,startY: number,endX: number,endY: number): boolean
    {
        const dx = endX - startX;
        const dy = endY - startY;

        const viewportWidth = Number(canvas.width);
        const viewportHeight = Number(canvas.height);

        if ((dx * dx + dy * dy) < MinDragDistanceSq ||
            viewportWidth <= 0.0 ||
            viewportHeight <= 0.0)
        {
            return false;
        }

        const cameraRight = vec3.create();
        vec3.cross(cameraRight, cameraFront, cameraUp);
        vec3.normalize(cameraRight, cameraRight);

        const cameraTrueUp = vec3.create();
        vec3.cross(cameraTrueUp, cameraRight, cameraFront);
        vec3.normalize(cameraTrueUp, cameraTrueUp);

        const cameraForward = vec3.create();
        vec3.normalize(cameraForward, cameraFront);

        const dragDirectionWorld = vec3.create();
        vec3.scale(dragDirectionWorld, cameraRight, dx);
        vec3.scaleAndAdd(dragDirectionWorld, dragDirectionWorld, cameraTrueUp, -dy);
        vec3.normalize(dragDirectionWorld, dragDirectionWorld);

        const planeNormal = vec3.create();
        vec3.cross(planeNormal, dragDirectionWorld, cameraForward);

        if (vec3.length(planeNormal) < MinPlaneNormalLength)
        {
            return false;
        }

        const midX = (startX + endX) * 0.5;
        const midY = (startY + endY) * 0.5;
        const ndcX = (midX / viewportWidth) * 2.0 - 1.0;
        const ndcY = 1.0 - (midY / viewportHeight) * 2.0;
        const aspect = viewportWidth / viewportHeight;
        const tanHalfFov = Math.tan((45.0 * Math.PI / 180.0) * 0.5);

        const rayDirection = vec3.create();
        vec3.scale(rayDirection, cameraRight, ndcX * aspect * tanHalfFov);
        vec3.scaleAndAdd(rayDirection,rayDirection,cameraTrueUp,ndcY * tanHalfFov);
        vec3.add(rayDirection, rayDirection, cameraForward);
        vec3.normalize(rayDirection, rayDirection);

        const denominator = vec3.dot(rayDirection, cameraForward);

        if (Math.abs(denominator) < MinPlaneNormalLength)
        {
            return false;
        }

        const modelFromCamera = vec3.create();
        vec3.subtract(modelFromCamera, modelWorldPosition, cameraPos);
        const rayDistance = vec3.dot(modelFromCamera, cameraForward) / denominator;

        const planePointWorld = vec3.create();
        vec3.scaleAndAdd(planePointWorld, cameraPos, rayDirection, rayDistance);

        vec3.subtract(this.planePoint, planePointWorld, modelWorldPosition);
        vec3.normalize(planeNormal, planeNormal);

        this.CutByPlane(sourceMesh, planeNormal);
        return true;
    }

    CutByPlane(sourceMesh: MeshData,normal: vec3): void
    {
        const positiveVertices: MeshVertex[] = [];
        const positiveIndices: number[] = [];
        const negativeVertices: MeshVertex[] = [];
        const negativeIndices: number[] = [];

        for (let i = 0; i + 2 < sourceMesh.indices.length; i += 3)
        {
            const triangle = [
                sourceMesh.vertices[sourceMesh.indices[i]],
                sourceMesh.vertices[sourceMesh.indices[i + 1]],
                sourceMesh.vertices[sourceMesh.indices[i + 2]]
            ];

            appendClippedTriangle(triangle,this.planePoint,normal,PositiveSide,positiveVertices,positiveIndices);
            appendClippedTriangle(triangle,this.planePoint,normal,NegativeSide,negativeVertices,negativeIndices);
        }

        if(positiveIndices.length === sourceMesh.indexCount || negativeIndices.length === sourceMesh.indexCount)
        {
            return;
        }

        this.positiveMesh.SetMesh(positiveVertices, positiveIndices);
        this.negativeMesh.SetMesh(negativeVertices, negativeIndices);
        vec3.copy(this.planeNormal, normal);
        this.isSliced = true;
        this.BuildGuide();

        // console.log(
        //     `Sliced mesh: positive ${this.positiveMesh.indexCount} indices, ` +
        //     `negative ${this.negativeMesh.indexCount} indices`
        // );
    }

    BuildGuide(): void
    {
        const direction = vec3.create();
        vec3.cross(direction, this.planeNormal, cameraFront);
        vec3.normalize(direction, direction);

        const start = vec3.create();
        const end = vec3.create();

        vec3.scaleAndAdd(start, this.planePoint, direction, -1.5);
        vec3.scaleAndAdd(end, this.planePoint, direction, 1.5);

        const vertices: MeshVertex[] = [
            {
                position: Array.from(start),
                normal: [0, 0, 1],
                texCoord: [0, 0]
            },
            {
                position: Array.from(end),
                normal: [0, 0, 1],
                texCoord: [0, 0]
            }
        ];

        this.guideMesh.SetMesh(vertices, [0, 1]);
        this.showGuide = true;
    }

    Reset(): void
    {
        this.isSliced = false;
    }

    Destroy(): void
    {
        this.positiveMesh.destroy();
        this.negativeMesh.destroy();
    }
}
