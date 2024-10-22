import { Box } from "@mui/material"
import UserInterface from "../userInterface/userInterface"
import {Container, Grid, Paper, TextField} from "@mui/material"
import { ClearFile } from "../userInterface/clearFile"
import { FileViewer } from "./fileViewer"
import { AddToBasket } from "../userInterface/addToBasket"
import { useDispatch, useSelector } from "react-redux"
import { RootState } from "../../app/store"
import { ChangeEvent } from "react"
import { setFileNameBoxValue } from "../../services/dataSlice"

export const MainOptions = () => {
    const dispatch = useDispatch()
    const dataState = useSelector(
        (state: RootState) => state.dataState,
      )
      const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        dispatch(setFileNameBoxValue({fileNameBoxValue: event.target.value}))
        // setFileNameBoxValue(event.target.value);
        // const updatedFile = new File([actualFile], event.target.value, {
        //   type: actualFile.type,
        // });
        // setActualFile(updatedFile);
      };
    return(
        <Box sx = {{marginTop: 10}}>
            <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={8} lg={12}>
                <Paper
                  sx={{
                    p: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    height: 850,
                  }}
                >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
          {
        //   hasStatePopulationErrors && 
          (
          <Box>
          <ClearFile 
                // setSelectedFile={setSelectedFile} 
                // setSelectedFileType={setSelectedFileType} 
                // setActualFile={setActualFile}  
                // fileInputRef={fileInputRef}
                // clearFiles={clearFiles}
                // statePopulationErrors={hasStatePopulationErrors}
              />
            </Box>
            )}
          <Box sx={{ textAlign: 'center', minHeight: '20px' }}>
            <>{
            // actualFile ? 
            <TextField value = {dataState.fileNameBoxValue} onChange = {handleChange}/> 
            // : <h4>&nbsp;</h4>
        }</>
          </Box>
          {
        //   hasStatePopulationErrors && 
          (
            <Box>
              <AddToBasket
                // printMaterial={printMaterial}
                // printTechnique={printTechnique}
                // multiplierValue={multiplierValue}
                // modelColour={modelColour}
                // file={actualFile}
                // setBasketItems = {setBasketItems}
                // basketItems = {basketItems}
                // clearFiles={clearFiles}
                // statePopulationErrors={hasStatePopulationErrors}
              />
            </Box>
          )}
        </Box>
              
                 <FileViewer 
                //  selectedFile = {selectedFile} 
                //  selectedFileType={selectedFileType}
                //  setSelectedFile = {setSelectedFile} 
                //  setSelectedFileType = {setSelectedFileType} 
                //  setActualFile = {setActualFile} 
                //  fileInputRef = {fileInputRef} 
                //  statePopulationErrors = {hasStatePopulationErrors}
                //  modelColour={modelColour}
                //  setModelVolume = {setModelVolume}
                //  setModelDimensions = {setModelDimensions}
                //  multiplierValue = {multiplierValue}
                //  setMaxScale={setMaxScale}
                //  maxScale={maxScale}
                //  setMinScale={setMinScale}
                //  minScale={minScale}
                //  meshyLoadingBoolean = {meshyLoading}
                //  setMeshyLoading={setMeshyLoading}
                //  meshyLoadedPercentage = {meshyLoadedPercentage}
                //  setMeshyLoadedPercentage = {setMeshyLoadedPercentage}
                //  fileNameBoxValue = {fileNameBoxValue}
                //  setFileNameBoxValue = {setFileNameBoxValue}
                 />
                 <Container sx={{marginTop: 3}}>
                 <Grid container spacing={10} justifyContent="center" >
                 <Grid item>
                 </Grid>
                 <Grid item>
                 
                 </Grid>
                 </Grid>

                 {/* {selectedFile ? <OptionTabs 
                 hasStatePopulationErrors = {hasStatePopulationErrors} 
                 setModelColour={setModelColour} 
                 modelColour = {modelColour} 
                 setPrintTechnique={setPrintTechnique} 
                 printTechnique={printTechnique} 
                 setPrintMaterial={setPrintMaterial} 
                 printMaterial={printMaterial}
                 modelVolume = {modelVolume}
                 modelDimensions = {modelDimensions}
                 setMultiplierValue = {setMultiplierValue}
                 multiplierValue = {multiplierValue}
                 maxScale={maxScale}
                 minScale = {minScale}
                 /> : <AiTextPrompt
                 setMeshyLoading = {setMeshyLoading}
                 setMeshyLoadedPercentage={setMeshyLoadedPercentage}
                 setSelectedFile = {setSelectedFile}
                 setSelectedFileType = {setSelectedFileType} 
                 setActualFile = {setActualFile}
                 /> } */}
                 
                 </Container>
                </Paper>
              </Grid>
              
              
            </Grid>
            
          </Container>
        </Box>
        
    )
}