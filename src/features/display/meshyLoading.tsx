import React from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";


  const MeshyLoading =() => {
    const userInterfaceState = useSelector(
      (state: RootState) => state.userInterfaceState
  )


    return (
      <div style={{border: '5px dashed', height: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column'}}>
            <CircularProgress variant={ (userInterfaceState.meshyLoading && !userInterfaceState.meshyPending) ?  'determinate': 'indeterminate'} value = {userInterfaceState.meshyLoadedPercentage} size={100}/>
            {(userInterfaceState.meshyLoading && userInterfaceState.meshyPending) && <>Task Queued: {userInterfaceState.meshyQueueItems} tasks ahead.</> }
            {(userInterfaceState.meshyLoading && !userInterfaceState.meshyPending) && <>{userInterfaceState.meshyLoadedPercentage}%</> }
      </div>
    )
  }


export default MeshyLoading