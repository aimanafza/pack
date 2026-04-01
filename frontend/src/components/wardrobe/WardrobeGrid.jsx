import { motion } from 'framer-motion'
import ItemCard, { cardVariants } from './ItemCard.jsx'
import styles from './WardrobeGrid.module.css'

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.05 },
  },
}

export default function WardrobeGrid({ items, onDelete, onEdit }) {
  return (
    <motion.div
      className={styles.grid}
      variants={container}
      initial="hidden"
      animate="show"
    >
      {items.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          onDelete={onDelete}
          onEdit={onEdit}
        />
      ))}
    </motion.div>
  )
}
