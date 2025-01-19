import { useLogOutMutation } from "../../services/authApi";
import { Box, Button } from "@mui/material"

export const ProfilePage = () => {

    const [
        logOut, 
        { 
          data: logOutData, 
          error: logOutError, 
          isLoading: isLogOutLoading 
        }
      ] = useLogOutMutation();

      const handleLogOut = () =>{
        logOut()
    }

    return (
        <Box>
            <Button onClick={handleLogOut}>Log Out</Button> 
        </Box>
    )

}