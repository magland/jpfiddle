import { BrowserRouter } from 'react-router-dom'
import HomePage from './HomePage'
import LogInPage from './LogInPage'
import useRoute from './useRoute'
import LoggedInPage from './LoggedInPage'
// import useRoute from './useRoute'

function App() {
  return (
    <BrowserRouter>
      <MainWindow />
    </BrowserRouter>
  )
}

function MainWindow() {
  const { route } = useRoute()
  if (route.page === 'home') {
    return <HomePage />
  }
  else if (route.page === 'logIn') {
    return <LogInPage />
  }
  else if (route.page === 'jpfiddle-login') {
    // redirected from the /auth endpoint
    return <LoggedInPage accessToken={route.access_token} />
  }
  else {
    return <div>Invalid route: {JSON.stringify(route)}</div>
  }
}

export default App
