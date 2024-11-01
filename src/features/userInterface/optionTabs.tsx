import * as React from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import * as THREE from "three";
import Box from '@mui/material/Box';
import PaletteIcon from '@mui/icons-material/Palette';
import ConstructionIcon from '@mui/icons-material/Construction';
import PhotoSizeSelectSmallIcon from '@mui/icons-material/PhotoSizeSelectSmall';
import SettingsIcon from '@mui/icons-material/Settings';
import { ColourSelectDropdown } from './colourDropdown';
import { MaterialSelectDropdown } from './materialsDropdown';
import SizingOptions  from './sizingOptions';

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
  }

// interface OptionTabsProps {
//   hasStatePopulationErrors: boolean
//   setModelColour: React.Dispatch<React.SetStateAction<string>>
//   modelColour: string
//   setPrintTechnique: React.Dispatch<React.SetStateAction<string>>
//   printTechnique: string
//   setPrintMaterial: React.Dispatch<React.SetStateAction<string>>
//   printMaterial: string
//   modelVolume: number
//   modelDimensions: THREE.Vector3
//   setMultiplierValue: React.Dispatch<React.SetStateAction<number>>
//   multiplierValue: number
//   maxScale: number
//   minScale: number
// }
  
  function CustomTabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;
  
    return (
      <div
        role="tabpanel"
        hidden={value !== index}
        id={`simple-tabpanel-${index}`}
        aria-labelledby={`simple-tab-${index}`}
        {...other}
      >
        {value === index && (
          <Box sx={{ p: 3 }}>
            <Typography>{children}</Typography>
          </Box>
        )}
      </div>
    );
  }
  
  function a11yProps(index: number) {
    return {
      id: `simple-tab-${index}`,
      'aria-controls': `simple-tabpanel-${index}`,
    };
  }
  
  export default function OptionTabs() {
    const [value, setValue] = React.useState(0);
  
    const handleChange = (event: React.SyntheticEvent, newValue: number) => {
      setValue(newValue);
    };
  
    return (
      <Box sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={value} onChange={handleChange} aria-label="basic tabs example" centered>
            <Tab label="Material" {...a11yProps(0)} icon={<ConstructionIcon/>}/>
            <Tab label="Colour" {...a11yProps(1)} icon={<PaletteIcon/>}/>
            <Tab label="Sizing" {...a11yProps(2)} icon={<PhotoSizeSelectSmallIcon/>}/>
            <Tab label="Settings" {...a11yProps(3)} icon={<SettingsIcon/>}/>
          </Tabs>
        </Box>
        <CustomTabPanel value={value} index={0}>
          <MaterialSelectDropdown 
        //   hasStatePopulationErrors = {props.hasStatePopulationErrors} 
        //   setPrintTechnique={props.setPrintTechnique} 
        //   printTechnique={props.printTechnique} 
        //   setPrintMaterial={props.setPrintMaterial} 
        //   printMaterial={props.printMaterial}
          />
        </CustomTabPanel>
        <CustomTabPanel value={value} index={1}>
        <ColourSelectDropdown 
        // hasStatePopulationErrors={props.hasStatePopulationErrors} 
        // setModelColour={props.setModelColour} 
        // modelColour = {props.modelColour}
        />
        </CustomTabPanel>
        <CustomTabPanel value={value} index={2}>
        <SizingOptions 
        //   modelVolume={props.modelVolume} 
        //   modelDimensions = {props.modelDimensions} 
        //   setMultiplierValue = {props.setMultiplierValue} 
        //   multiplierValue = {props.multiplierValue} 
        //   hasStatePopulationErrors = {props.hasStatePopulationErrors}
        //   maxScale = {props.maxScale}
        //   minScale={props.minScale}
          />
        </CustomTabPanel>
        <CustomTabPanel value={value} index={3}>
         Settings
        </CustomTabPanel>
      </Box>
    );
  }