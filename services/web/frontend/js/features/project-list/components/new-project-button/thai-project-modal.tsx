import { OLModal } from '@/shared/components/ol/ol-modal'
import ModalContentNewProjectForm from './modal-content-new-project-form'
import { Tag } from '../../../../../../app/src/Features/Tags/types'
import { useFeatureFlag } from '@/shared/context/split-test-context'

type ThaiProjectModalProps = {
  onHide: () => void
  initialTags?: Tag[]
}

// Blank project set up for Thai: XeLaTeX, Thai fonts and line breaking
function ThaiProjectModal({ onHide, initialTags }: ThaiProjectModalProps) {
  const themed = useFeatureFlag('themed-modals')

  return (
    <OLModal
      show
      animation
      onHide={onHide}
      id="thai-project-modal"
      backdrop="static"
      themed={themed}
      className="project-list-modal"
    >
      <ModalContentNewProjectForm
        onCancel={onHide}
        template="thai"
        initialTags={initialTags}
      />
    </OLModal>
  )
}

export default ThaiProjectModal
