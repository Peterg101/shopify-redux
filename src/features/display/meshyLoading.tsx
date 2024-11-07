import React from 'react';
import CircularProgress from '@mui/material/CircularProgress';

interface meshyLoadingProps{
    loadedPercentage: number;
  }

  const MeshyLoading =() => {

    return (
      <div style={{border: '5px dashed', height: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column'}}>
        <CircularProgress variant={loadedPercentage === 0 ? 'indeterminate' : 'determinate'} value={loadedPercentage} size={100} />
         { loadedPercentage === 0 ? (<h3>Task Queued</h3>):<h3>{loadedPercentage}% complete</h3>}
       
      </div>
    )
  }


export default MeshyLoading