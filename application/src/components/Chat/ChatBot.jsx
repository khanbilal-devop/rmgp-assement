import { useEffect, useRef, useState } from 'react'
import Icon from '../Archive/components/icons.jsx'
import { fetchGames } from '../../api/gamesApi.js'
import { parseQuestion } from './parseQuestion.js'
import { GREETING_TEXT, HELP_TEXT, NOT_IN_COLLECTION, UNKNOWN, buildAnswer } from './buildAnswer.js'
import { suggestTitles } from './suggestTitles.js'
import './ChatBot.css'

const SUGGESTIONS = [
  { label: '🎮 1980s games', question: 'Which games are from the 1980s?' },
  { label: '👥 Two players', question: 'Which games are for two players?' },
  { label: '📱 Phone games', question: 'Which games run on a mobile phone?' },
  { label: '❓ Help', question: 'help' },
]

const FACET_KEYS = ['type', 'device', 'play_style', 'connectivity', 'origin', 'maker']

let nextId = 1
const message = (from, content) => ({ id: nextId++, from, ...content })

// Floating "collection guide" that answers questions from the games API only.
// It never invents a game: every title it lists comes from the API's answer.
function ChatBot() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([message('bot', { text: GREETING_TEXT })])
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const options = useRef(null)
  const titles = useRef(null)
  const launcher = useRef(null)
  const input = useRef(null)
  const list = useRef(null)

  const wasOpen = useRef(false)

  // Focus the text box on open, and give focus back to the round button on close.
  useEffect(() => {
    if (open) input.current?.focus()
    else if (wasOpen.current) launcher.current?.focus()
    wasOpen.current = open
  }, [open])

  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight
  }, [messages, thinking])

  const close = () => setOpen(false)

  // The filter values the guide can recognise, read once from the collection itself.
  const loadOptions = async () => {
    if (!options.current) {
      const all = await fetchGames(new URLSearchParams())
      options.current = Object.fromEntries(FACET_KEYS.map((key) => [key, all.facets[key].map((row) => row.value)]))
    }
    return options.current
  }

  // Every title in the collection, read page by page the first time a title search finds nothing.
  const loadTitles = async () => {
    if (!titles.current) {
      const first = await fetchGames(new URLSearchParams())
      const rest = await Promise.all(
        Array.from({ length: first.pages - 1 }, (_, i) => fetchGames(new URLSearchParams({ page: i + 2 }))),
      )
      titles.current = [first, ...rest].flatMap((page) => page.items.map((game) => game.title))
    }
    return titles.current
  }

  const reply = async (question) => {
    const parsed = parseQuestion(question, await loadOptions())
    if (parsed.kind === 'greeting') return { text: GREETING_TEXT }
    if (parsed.kind === 'help') return { text: HELP_TEXT }
    if (parsed.kind !== 'search') return { text: UNKNOWN }
    const result = await fetchGames(new URLSearchParams(parsed.params))
    if (result.total === 0 && parsed.params.q) {
      const suggestions = suggestTitles(parsed.params.q, await loadTitles())
      if (suggestions.length) return { text: `${NOT_IN_COLLECTION} Did you mean:`, suggestions }
    }
    return buildAnswer(parsed, result)
  }

  const ask = async (question) => {
    const text = question.trim()
    if (!text || thinking) return
    setDraft('')
    setMessages((previous) => [...previous, message('user', { text })])
    setThinking(true)
    let answer
    try {
      answer = await reply(text)
    } catch {
      answer = { text: "Sorry, I couldn't reach the collection just now. Please try again." }
    }
    setMessages((previous) => [...previous, message('bot', answer)])
    setThinking(false)
  }

  const asked = messages.some((m) => m.from === 'user')

  return (
    <div className="chat">
      {open ? (
        <div
          className="chat-panel" role="dialog" aria-labelledby="chat-title"
          onKeyDown={(e) => e.key === 'Escape' && close()}
        >
          <div className="chat-header">
            <div className="chat-title">
              <Icon name="message" size={20} />
              <span id="chat-title">Collection guide</span>
              <span className="chat-subtitle">Answers from this collection</span>
            </div>
            <button type="button" className="chat-close" aria-label="Close the collection guide" onClick={close}>
              <Icon name="x" size={16} />
            </button>
          </div>

          <div ref={list} className="chat-messages" aria-live="polite">
            {messages.map((m) => (
              <div key={m.id} className={`chat-row chat-row-${m.from}`}>
                <div className={`chat-bubble chat-bubble-${m.from}`}>
                  <p>{m.text}</p>
                  {m.games && (
                    <ul>
                      {m.games.map((game) => <li key={game}>{game}</li>)}
                    </ul>
                  )}
                  {m.footer && <p className="chat-footer">{m.footer}</p>}
                  {m.suggestions && (
                    <div className="chat-suggestions chat-did-you-mean">
                      {m.suggestions.map((title) => (
                        <button key={title} type="button" onClick={() => ask(title)}>{title}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {!asked && (
              <div className="chat-suggestions">
                {SUGGESTIONS.map((s) => (
                  <button key={s.label} type="button" onClick={() => ask(s.question)}>{s.label}</button>
                ))}
              </div>
            )}
            {thinking && (
              <div className="chat-thinking">
                <span className="chat-dots" aria-hidden="true"><span /><span /><span /></span>
                Looking through the collection…
              </div>
            )}
          </div>

          <form className="chat-form" onSubmit={(e) => { e.preventDefault(); ask(draft) }}>
            <label className="visually-hidden" htmlFor="chat-input">Ask about the collection</label>
            <input
              ref={input} id="chat-input" type="text" autoComplete="off" placeholder="Ask about the collection…"
              value={draft} onChange={(e) => setDraft(e.target.value)} disabled={thinking}
            />
            <button type="submit" className="chat-send" aria-label="Send" disabled={!draft.trim() || thinking}>
              <Icon name="send" size={16} />
            </button>
          </form>
        </div>
      ) : (
        <button
          ref={launcher} type="button" className="chat-launcher"
          aria-label="Open the collection guide" aria-expanded="false" onClick={() => setOpen(true)}
        >
          <Icon name="message" size={24} />
        </button>
      )}
    </div>
  )
}

export default ChatBot
