import Navbar from './components/Navbar/Navbar.jsx'
import Hero from './components/Hero/Hero.jsx'
import Archive from './components/Archive/Archive.jsx'
import About from './components/About/About.jsx'
import ChatBot from './components/Chat/ChatBot.jsx'

function App() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Archive />
        <About />
      </main>
      <ChatBot />
    </>
  )
}

export default App
