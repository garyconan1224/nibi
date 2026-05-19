import './workbench.css'
import { Hero } from './Hero'
import { Composer } from './Composer'
import { RecentTasks } from './RecentTasks'

export default function WorkbenchPage() {
  return (
    <div className="workbench-scroll">
      <Hero />
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '0 32px' }}>
        <Composer />
      </div>
      <RecentTasks />
    </div>
  )
}
