import { FunctionComponent, useEffect } from "react"
import useRoute from "./useRoute"

type Props = {
    accessToken: string
}

const LoggedInPage: FunctionComponent<Props> = ({ accessToken }) => {
    // redirected from /auth endpoint
    const {setRoute} = useRoute()
    useEffect(() => {
        localStorage.setItem('github_access_token', JSON.stringify({accessToken}))
        setRoute({
            page: 'home'
        })
    }, [setRoute, accessToken])
    return (
        <div>Logging in</div>
    )
}

export default LoggedInPage