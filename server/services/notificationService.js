const LOW_STOCK_THRESHOLD = Number(process.env.LOW_STOCK_THRESHOLD || 5)

export function getLowStockThreshold() {
  return Number.isFinite(LOW_STOCK_THRESHOLD) && LOW_STOCK_THRESHOLD > 0
    ? LOW_STOCK_THRESHOLD
    : 5
}

export async function ensureNotificationSchema(poolOrConnection) {
  await poolOrConnection.execute(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NULL,
      type VARCHAR(60) NOT NULL,
      title VARCHAR(191) NOT NULL,
      message TEXT NOT NULL,
      is_read TINYINT(1) NOT NULL DEFAULT 0,
      related_id INT UNSIGNED NULL,
      related_type VARCHAR(80) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      read_at DATETIME NULL,
      PRIMARY KEY (id),
      KEY notifications_user_created_index (user_id, created_at),
      KEY notifications_user_read_index (user_id, is_read),
      KEY notifications_type_index (type),
      KEY notifications_related_index (related_type, related_id),
      CONSTRAINT notifications_user_fk
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE SET NULL
    )
  `)
}

export function mapNotification(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    isRead: Boolean(row.is_read),
    createdAt: row.created_at,
    readAt: row.read_at,
    relatedId: row.related_id,
    relatedType: row.related_type,
  }
}

export async function createNotification(poolOrConnection, {
  userId = null,
  type,
  title,
  message,
  relatedId = null,
  relatedType = null,
}) {
  if (!type || !title || !message) return null

  const [result] = await poolOrConnection.execute(
    `INSERT INTO notifications
     (user_id, type, title, message, related_id, related_type)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, type, title, message, relatedId, relatedType]
  )

  return result.insertId
}

export async function createVisitNotification(poolOrConnection, visit, userId) {
  return createNotification(poolOrConnection, {
    userId,
    type: 'NEW_CLINIC_VISIT',
    title: 'New Clinic Visit',
    message: `${visit.name} has been registered for a clinic visit.`,
    relatedId: visit.id,
    relatedType: 'visit',
  })
}

export async function createSentHomeNotification(poolOrConnection, visit, userId) {
  return createNotification(poolOrConnection, {
    userId,
    type: 'STUDENT_SENT_HOME',
    title: 'Patient Sent Home',
    message: `${visit.name} was marked as sent home.`,
    relatedId: visit.id,
    relatedType: 'visit',
  })
}

export async function createParentEmailNotification(poolOrConnection, visit, userId, status) {
  if (status === 'sent') {
    return createNotification(poolOrConnection, {
      userId,
      type: 'PARENT_NOTIFICATION_SENT',
      title: 'Parent Notification Sent',
      message: `Patient notification for ${visit.name} was sent successfully.`,
      relatedId: visit.id,
      relatedType: 'visit',
    })
  }

  if (status === 'failed') {
    return createNotification(poolOrConnection, {
      userId,
      type: 'PARENT_NOTIFICATION_FAILED',
      title: 'Parent Notification Failed',
      message: `The patient notification for ${visit.name} could not be sent.`,
      relatedId: visit.id,
      relatedType: 'visit',
    })
  }

  return null
}

export async function createMedicineStockNotifications(poolOrConnection, {
  medicine,
  previousQuantity,
  nextQuantity,
  changeQuantity,
  userId,
}) {
  if (!medicine) return

  const threshold = getLowStockThreshold()
  const previous = Number(previousQuantity) || 0
  const next = Number(nextQuantity) || 0
  const change = Number(changeQuantity) || 0
  const unitLabel = Math.abs(next) === 1 ? 'unit' : 'units'
  const changeLabel = Math.abs(change) === 1 ? 'unit' : 'units'

  if (change > 0) {
    await createNotification(poolOrConnection, {
      userId,
      type: 'MEDICINE_RESTOCKED',
      title: 'Medicine Restocked',
      message: `${medicine.name} has been restocked with ${change} ${changeLabel}.`,
      relatedId: medicine.id,
      relatedType: 'medicine',
    })
  }

  if (next === 0 && previous > 0) {
    await createNotification(poolOrConnection, {
      userId,
      type: 'MEDICINE_OUT_OF_STOCK',
      title: 'Medicine Out of Stock',
      message: `${medicine.name} is currently out of stock.`,
      relatedId: medicine.id,
      relatedType: 'medicine',
    })
    return
  }

  if (next > 0 && next <= threshold && (previous === 0 || previous > threshold)) {
    await createNotification(poolOrConnection, {
      userId,
      type: 'LOW_MEDICINE_STOCK',
      title: 'Low Medicine Stock',
      message: `${medicine.name} has only ${next} ${unitLabel} remaining.`,
      relatedId: medicine.id,
      relatedType: 'medicine',
    })
  }
}
