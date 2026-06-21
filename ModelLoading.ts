"use strict";

import { gl, vertexAttributeEnum } from "./common";

export interface MeshVertex {
    position: number[];
    normal: number[];
    texCoord: number[];
}

export class MeshData
{
    vao: WebGLVertexArrayObject | null = null;
    vbo: WebGLBuffer | null = null;
    ebo: WebGLBuffer | null = null;
    indexCount = 0;
    vertices: MeshVertex[] = [];
    indices: number[] = [];

    constructor()
    {
    }

    async LoadModel(path: string): Promise<boolean>
    {
        try
        {
            const response = await fetch(path);
            if (!response.ok)
            {
                console.error(`Assimp error: failed to load ${path}`);
                return false;
            }

            const assimp = await assimpjs();
            const fileList = new assimp.FileList();
            const fileName = path.split("/").pop() ?? "model";
            const fileData = new Uint8Array(await response.arrayBuffer());
            fileList.AddFile(fileName, fileData);

            const result = assimp.ConvertFileList(fileList, "assjson");
            if (!result.IsSuccess() || result.FileCount() === 0)
            {
                console.error(`Assimp error: ${result.GetErrorCode()}`);
                return false;
            }

            const resultFile = result.GetFile(0);
            const jsonText = new TextDecoder().decode(resultFile.GetContent());
            const scene = JSON.parse(jsonText);

            if (!scene || !scene.meshes || scene.meshes.length === 0)
            {
                console.error("Assimp error: scene has no meshes");
                return false;
            }

            const mesh = scene.meshes[0];

            this.vertices.length = 0;
            this.indices.length = 0;

            const vertexCount = mesh.vertices.length / 3;
            const textureCoordinates = mesh.texturecoords && mesh.texturecoords[0]
                ? mesh.texturecoords[0]
                : null;
            const textureCoordinateSize = textureCoordinates
                ? textureCoordinates.length / vertexCount
                : 0;

            for (let i = 0; i < vertexCount; i++)
            {
                const vertex = {} as MeshVertex;

                vertex.position = [
                    mesh.vertices[i * 3],
                    mesh.vertices[i * 3 + 1],
                    mesh.vertices[i * 3 + 2]
                ];

                // --- Normal ---
                if (mesh.normals && mesh.normals.length > 0)
                {
                    vertex.normal = [
                        mesh.normals[i * 3],
                        mesh.normals[i * 3 + 1],
                        mesh.normals[i * 3 + 2]
                    ];
                }
                else
                {
                    vertex.normal = [0.0, 0.0, 1.0];
                }

                // --- Texture Coordinates ---
                if (textureCoordinates)
                {
                    vertex.texCoord = [
                        textureCoordinates[i * textureCoordinateSize],
                        1.0 - textureCoordinates[i * textureCoordinateSize + 1]
                    ];
                }
                else 
                {
                    vertex.texCoord = [0.0, 0.0];
                }

                this.vertices.push(vertex);
            }

            for (let i = 0; i < mesh.faces.length; i++)
            {
                const face = mesh.faces[i];
                for (let j = 0; j < face.length; j++)
                {
                    this.indices.push(face[j]);
                }
            }

            this.upload();

            console.log(
                `Model loaded: ${path} with ${vertexCount} vertices and ${this.indexCount} indices`
            );

            return true;
        }
        catch (error: unknown)
        {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`Assimp error: ${message}`);
            return false;
        }
    }

    SetMesh(newVertices: Iterable<MeshVertex>, newIndices: Iterable<number>): void
    {
        this.vertices = Array.from(newVertices);
        this.indices = Array.from(newIndices);
        this.upload();
    }

    upload(): void
    {
        const vertexData = new Float32Array(this.vertices.length * 8);

        for (let i = 0; i < this.vertices.length; i++)
        {
            const vertex = this.vertices[i];
            const offset = i * 8;

            vertexData.set(vertex.position, offset);
            vertexData.set(vertex.normal, offset + 3);
            vertexData.set(vertex.texCoord, offset + 6);
        }

        if (this.vao === null)
        {
            this.vao = gl.createVertexArray();
        }
        gl.bindVertexArray(this.vao);

        if (this.vbo === null)
        {
            this.vbo = gl.createBuffer();
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);

        if (this.ebo === null)
        {
            this.ebo = gl.createBuffer();
        }
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ebo);
        gl.bufferData(
            gl.ELEMENT_ARRAY_BUFFER,
            new Uint32Array(this.indices),
            gl.STATIC_DRAW
        );

        const stride = 8 * Float32Array.BYTES_PER_ELEMENT;

        gl.vertexAttribPointer(vertexAttributeEnum.AMC_ATTRIBUTE_POSITION,3,gl.FLOAT,false,stride,0);
        gl.enableVertexAttribArray(vertexAttributeEnum.AMC_ATTRIBUTE_POSITION);

        gl.vertexAttribPointer(vertexAttributeEnum.AMC_ATTRIBUTE_NORMAL,3,gl.FLOAT,false,stride,3 * Float32Array.BYTES_PER_ELEMENT);
        gl.enableVertexAttribArray(vertexAttributeEnum.AMC_ATTRIBUTE_NORMAL);

        gl.vertexAttribPointer(vertexAttributeEnum.AMC_ATTRIBUTE_TEXCOORD,2,gl.FLOAT,false,stride,6 * Float32Array.BYTES_PER_ELEMENT);
        gl.enableVertexAttribArray(vertexAttributeEnum.AMC_ATTRIBUTE_TEXCOORD);

        gl.bindVertexArray(null);

        this.indexCount = this.indices.length;
    }

    destroy(): void
    {
        if (this.ebo)
        {
            gl.deleteBuffer(this.ebo);
            this.ebo = null;
        }

        if (this.vbo)
        {
            gl.deleteBuffer(this.vbo);
            this.vbo = null;
        }

        if (this.vao)
        {
            gl.deleteVertexArray(this.vao);
            this.vao = null;
        }
    }
}
