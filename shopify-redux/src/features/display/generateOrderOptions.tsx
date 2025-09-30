import { UpdatedUserInterface } from "../userInterface/updatedUserInterface"
import LoginDialog from "./loginDialogue"
import { MainOptions } from "./mainOptions"


export const GenerateOrderOptions = () =>{

    return(
        <div>
            <UpdatedUserInterface/>
            <MainOptions/>
            <LoginDialog/>
        </div>
    )
}