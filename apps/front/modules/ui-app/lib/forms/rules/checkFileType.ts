export function checkFileType(file: File, formats: string[]) {
    if (file?.name) {
        const fileType = file.name.split(".").pop();
        if (fileType && formats.includes(fileType)) return true;
    }
    return false;
}