type Vec3 = Float32Array;
type Mat4 = Float32Array;

interface AssimpFileList {
    AddFile(name: string, data: Uint8Array): void;
}

interface AssimpResultFile {
    GetContent(): Uint8Array;
}

interface AssimpResult {
    IsSuccess(): boolean;
    FileCount(): number;
    GetErrorCode(): string;
    GetFile(index: number): AssimpResultFile;
}

interface AssimpModule {
    FileList: new () => AssimpFileList;
    ConvertFileList(files: AssimpFileList, format: string): AssimpResult;
}

declare function assimpjs(): Promise<AssimpModule>;

interface MeshVertex {
    position: number[];
    normal: number[];
    texCoord: number[];
}

interface Window {
    main: () => Promise<void>;
}
