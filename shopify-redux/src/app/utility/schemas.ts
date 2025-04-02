export const validationSchema = {
    printMaterial: (value: any) => value !== null && value !== undefined,
    printTechnique: (value: any) => value !== null && value !== undefined,
    modelColour: (value: any) => value !== null && value !== undefined
};