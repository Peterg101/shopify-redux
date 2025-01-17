import { Box, Button, Slider } from "@mui/material"
import { useDispatch } from "react-redux"
import { setXFLip, setYFLip, setZFLip } from "../../services/dataSlice"
import { useState } from "react"
import { degreesToRadians } from "../../app/utility/utils"


export const SettingsMenu = () => {
    const [xValue, setXValue] = useState<number>(0)
    const [yValue, setYValue] = useState<number>(0)
    const [zValue, setZValue] = useState<number>(0)
    const dispatch = useDispatch()

    const handleXChange = (event: Event, newValue: number|  number[]) => {
        if (typeof newValue === 'number') {
            const radians = degreesToRadians(newValue)
            dispatch(setXFLip({xFlip: radians}))
            setXValue(newValue)
        }
    }

    const handleYChange = (event: Event, newValue: number|  number[]) => {
        if (typeof newValue === 'number') {
            const radians = degreesToRadians(newValue)
            dispatch(setYFLip({yFlip: radians}))
            setYValue(newValue)
        }
    }

    const handleZChange = (event: Event, newValue: number|  number[]) => {
        if (typeof newValue === 'number') {
            const radians = degreesToRadians(newValue)
            dispatch(setZFLip({zFlip: radians}))
            setZValue(newValue)
        }
    }
    

    return(
        <div>
            
           
            <Slider 
            aria-label="Volume" 
             value = {xValue}
              onChange={handleXChange}
                min={-180} step={1} max={180}  />
            
            <Slider 
            aria-label="Volume" 
             value = {yValue}
              onChange={handleYChange}
                min={-180} step={1} max={180}  />
            
            <Slider 
            aria-label="Volume" 
             value = {zValue}
              onChange={handleZChange}
                min={-180} step={1} max={180}  />
            
        </div>
    )
}