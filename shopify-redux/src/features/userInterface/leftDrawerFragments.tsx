import { Typography, Box } from "@mui/material";
import { TaskInformation } from "../../app/utility/interfaces";
import { useSelector } from "react-redux";
import { RootState } from "../../app/store";
import React from "react";

export const LeftDrawerTask = (task: TaskInformation) => {
    return(
        <div style={{marginBottom: 20}}>
            <Typography>Task Name: {task.task_name}</Typography>
            <Typography>Created At: {task.created_at}</Typography>
        </div>
        
    )
}

export const LeftDrawerList = () =>{
    const userInterfaceState = useSelector(
        (state: RootState) => state.userInterfaceState,
      )

    return(
        <React.Fragment>
            {userInterfaceState.userInformation?.tasks.map((task) => (
                <LeftDrawerTask key ={task.task_id} {...task}/>
            ))}
        </React.Fragment>
    )

}