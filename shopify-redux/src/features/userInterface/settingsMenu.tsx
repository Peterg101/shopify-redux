import { Box, Slider, Typography } from "@mui/material"
import { useDispatch } from "react-redux"
import { setXFLip, setYFLip, setZFLip } from "../../services/dataSlice"
import { useState } from "react"
import { degreesToRadians } from "../../app/utility/utils"

export const SettingsMenu = () => {
    const [xValue, setXValue] = useState<number>(0)
    const [yValue, setYValue] = useState<number>(0)
    const [zValue, setZValue] = useState<number>(0)
    const dispatch = useDispatch()

    const handleXChange = (_event: Event, newValue: number | number[]) => {
        if (typeof newValue === 'number') {
            dispatch(setXFLip({ xFlip: degreesToRadians(newValue) }))
            setXValue(newValue)
        }
    }

    const handleYChange = (_event: Event, newValue: number | number[]) => {
        if (typeof newValue === 'number') {
            dispatch(setYFLip({ yFlip: degreesToRadians(newValue) }))
            setYValue(newValue)
        }
    }

    const handleZChange = (_event: Event, newValue: number | number[]) => {
        if (typeof newValue === 'number') {
            dispatch(setZFLip({ zFlip: degreesToRadians(newValue) }))
            setZValue(newValue)
        }
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box>
                <Typography variant="body2" color="text.secondary">X Rotation: {xValue}°</Typography>
                <Slider
                    aria-label="X axis rotation"
                    value={xValue}
                    onChange={handleXChange}
                    min={-180} step={1} max={180}
                />
            </Box>

            <Box>
                <Typography variant="body2" color="text.secondary">Y Rotation: {yValue}°</Typography>
                <Slider
                    aria-label="Y axis rotation"
                    value={yValue}
                    onChange={handleYChange}
                    min={-180} step={1} max={180}
                />
            </Box>

            <Box>
                <Typography variant="body2" color="text.secondary">Z Rotation: {zValue}°</Typography>
                <Slider
                    aria-label="Z axis rotation"
                    value={zValue}
                    onChange={handleZChange}
                    min={-180} step={1} max={180}
                />
            </Box>
        </Box>
    )
}
