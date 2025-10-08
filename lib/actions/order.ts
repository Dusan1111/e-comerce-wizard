"use server"

import { redirect } from "next/navigation"

export interface OrderItem {
  _id: string
  name: string
  price: number
  salePrice?: number
  quantity: number
  category: string
  image: string
}

export interface CustomerInfo {
  fullName: string
  email: string
  phone: string
  address: string
  city: string
  postalCode: string
}

export interface OrderSummary {
  items: OrderItem[]
  customerInfo: CustomerInfo
  subtotal: number
  shipping: number
  total: number
  orderDate: string
}

export async function processOrder(orderData: OrderSummary) {
  try {
    console.log("Processing order for:", orderData.customerInfo.fullName)

    // Save order to database first
    const savedOrder = await saveOrderToDatabase(orderData)
    console.log("Order saved to database with ID:", savedOrder.orderId)

    // Format the order email content
    const emailContent = formatOrderEmail(orderData)
    console.log("Email content formatted successfully")

    // Send email to both admin and customer
    await sendAdminEmail(emailContent, orderData)
    await sendCustomerEmail(orderData)
    console.log("Email sent successfully")

    return {
      success: true,
      message: "Porudžbina je uspešno poslata!",
      orderId: savedOrder.orderId
    }
  } catch (error) {
    const errorMessage = typeof error === "object" && error !== null && "message" in error ? (error as { message: string }).message : String(error)
    return { success: false, message: `Greška pri slanju porudžbine: ${errorMessage}` }
  }
}

function formatOrderEmail(orderData: OrderSummary): string {
  const { items, customerInfo, shipping, total, orderDate } = orderData
  const BLOB_URL = process.env.NEXT_PUBLIC_BLOB_URL

  let emailHTML = `
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background-color: #4f687b; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .customer-info { background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .order-items { margin: 20px 0; }
        .item { border-bottom: 1px solid #eee; padding: 15px 0; margin-bottom: 10px; }
        .item-row { display: flex; align-items: center; margin-bottom: 8px; }
        .item-row.name-image { align-items: center; gap: 15px; min-height: 60px; }
        .item-image { width: 60px; height: 60px; object-fit: cover; border-radius: 8px; border: 1px solid #ddd; }
        .item-name { font-weight: bold; font-size: 16px; margin: 0; display: flex; align-items: center; height: 60px; }
        .item-quantity, .item-price-per-unit { font-size: 14px; color: #666; }
        .item-total { text-align: right; font-weight: bold; font-size: 16px; color: #4f687b; }
        .totals { background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .total-row { display: flex; justify-content: space-between; margin: 5px 0; }
        .final-total { font-weight: bold; font-size: 18px; border-top: 2px solid #4f687b; padding-top: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Nova porudžbina - Sany Swings</h1>
        <p>Datum: ${orderDate}</p>
      </div>

      <div class="content">
        <h2>Informacije o kupcu</h2>
        <div class="customer-info">
          <p><strong>Ime i prezime:</strong> ${customerInfo.fullName}</p>
          <p><strong>Email:</strong> ${customerInfo.email}</p>
          <p><strong>Telefon:</strong> ${customerInfo.phone}</p>
          <p><strong>Adresa:</strong> ${customerInfo.address}</p>
          <p><strong>Grad:</strong> ${customerInfo.city}</p>
          <p><strong>Poštanski kod:</strong> ${customerInfo.postalCode}</p>
        </div>

        <h2>Stavke porudžbine</h2>
        <div class="order-items">
  `

  items.forEach(item => {
    const itemPrice = Number(item.salePrice) || Number(item.price) || 0
    const itemTotal = itemPrice * item.quantity

    // Use BLOB_URL format for images
    const imageUrl = item.image && item.image.trim()
      ? `${BLOB_URL}/${item.image}`
      : 'https://via.placeholder.com/80x80/f0f0f0/666666?text=No+Image'

    emailHTML += `
      <div class="item">
        <div class="item-row name-image">
          <img src="${imageUrl}" alt="${item.name}" class="item-image" onerror="this.src='https://via.placeholder.com/80x80/f0f0f0/666666?text=No+Image'" />
          <h4 class="item-name">${item.name}</h4>
        </div>
        <div class="item-row">
          <span class="item-quantity">Količina: ${item.quantity}</span>
        </div>
        <div class="item-row">
          <span class="item-price-per-unit">Cena po komadu: ${itemPrice.toFixed(2)} RSD</span>
        </div>
        <div class="item-row">
          <span class="item-total">Iznos: ${itemTotal.toFixed(2)} RSD</span>
        </div>
      </div>
    `
  })

  emailHTML += `
        </div>

        <div class="totals">
          <div class="total-row">
            <span>Dostava:</span>
            <span>${Number(shipping) === 0 ? 'Besplatno' : Number(shipping).toFixed(2) + ' RSD'}</span>
          </div>
          <div class="total-row final-total">
            <span>UKUPNO:</span>
            <span>${Number(total).toFixed(2)} RSD</span>
          </div>
        </div>

        <p><em>Hvala vam na porudžbini!</em></p>
      </div>
    </body>
    </html>
  `

  return emailHTML
}

function formatCustomerEmail(orderData: OrderSummary): string {
  const { items, customerInfo, subtotal, shipping, total, orderDate } = orderData
  const BLOB_URL = process.env.NEXT_PUBLIC_BLOB_URL

  let emailHTML = `
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background-color: #4f687b; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .order-items { margin: 20px 0; }
        .item { border-bottom: 1px solid #eee; padding: 15px 0; margin-bottom: 10px; }
        .item-row { display: flex; align-items: center; margin-bottom: 8px; }
        .item-row.name-image { align-items: center; gap: 15px; min-height: 60px; }
        .item-image { width: 60px; height: 60px; object-fit: cover; border-radius: 8px; border: 1px solid #ddd; }
        .item-name { font-weight: bold; font-size: 16px; margin: 0; display: flex; align-items: center; height: 60px; }
        .item-quantity, .item-price-per-unit { font-size: 14px; color: #666; }
        .item-total { text-align: right; font-weight: bold; font-size: 16px; color: #4f687b; }
        .totals { background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .total-row { display: flex; justify-content: space-between; margin: 5px 0; }
        .final-total { font-weight: bold; font-size: 18px; border-top: 2px solid #4f687b; padding-top: 10px; }
        .thank-you { background-color: #f1f5f8; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Hvala na Vašoj porudžbini!</h1>
        <p>Sany Swings</p>
      </div>

      <div class="content">
        <div class="thank-you">
          <h2>Poštovani/a ${customerInfo.fullName},</h2>
          <p>Hvala Vam što ste odabrali Sany Swings! Vaša porudžbina je uspešno primljena.</p>
          <p><strong>Datum porudžbine:</strong> ${orderDate}</p>
        </div>

        <h2>Detalji Vaše porudžbine</h2>
        <div class="order-items">
  `

  items.forEach(item => {
    const itemPrice = Number(item.salePrice) || Number(item.price) || 0
    const itemTotal = itemPrice * item.quantity

    // Use BLOB_URL format for images
    const imageUrl = item.image && item.image.trim()
      ? `${BLOB_URL}/${item.image}`
      : 'https://via.placeholder.com/80x80/f0f0f0/666666?text=No+Image'

    emailHTML += `
      <div class="item">
        <div class="item-row name-image">
          <img src="${imageUrl}" alt="${item.name}" class="item-image" onerror="this.src='https://via.placeholder.com/80x80/f0f0f0/666666?text=No+Image'" />
          <h4 class="item-name">${item.name}</h4>
        </div>
        <div class="item-row">
          <span class="item-quantity">Količina: ${item.quantity}</span>
        </div>
        <div class="item-row">
          <span class="item-price-per-unit">Cena po komadu: ${itemPrice.toFixed(2)} RSD</span>
        </div>
        <div class="item-row">
          <span class="item-total">Iznos: ${itemTotal.toFixed(2)} RSD</span>
        </div>
      </div>
    `
  })

  emailHTML += `
        </div>

        <div class="totals">
          <div class="total-row">
            <span>Dostava:</span>
            <span>${Number(shipping) === 0 ? 'Besplatno' : Number(shipping).toFixed(2) + ' RSD'}</span>
          </div>
          <div class="total-row final-total">
            <span>UKUPNO:</span>
            <span>${Number(total).toFixed(2)} RSD</span>
          </div>
        </div>

        <h3>Adresa dostave</h3>
        <p>
          ${customerInfo.fullName}<br>
          ${customerInfo.address}<br>
          ${customerInfo.city}, ${customerInfo.postalCode}<br>
          Telefon: ${customerInfo.phone}
        </p>

        <div class="thank-you">
          <p><strong>Šta je sledeće?</strong></p>
          <p>Kontaktiraćemo Vas u najkraćem roku radi potvrde porudžbine i dogovora dostave.</p>
          <p>Ukoliko imate bilo kakva pitanja, možete nas kontaktirati na:</p>
          <p>📧 Email: infosanyswings@gmail.com</p>
          <p>📞 Telefon: 1-800-555-1234</p>
        </div>

        <p style="text-align: center; color: #666; margin-top: 30px;">
          <em>Hvala Vam što ste odabrali Sany Swings za igru vaše dece!</em>
        </p>
      </div>
    </body>
    </html>
  `

  return emailHTML
}

// Send detailed order email to admin
async function sendAdminEmail(emailContent: string, orderData: OrderSummary) {
  const emailData = {
    to: "panticdusan93@gmail.com",
    subject: `Nova porudžbina od ${orderData.customerInfo.fullName} - ${orderData.orderDate}`,
    html: emailContent,
    from: process.env.EMAIL_USER || "noreply@kidsswinghamaven.com"
  }

  return await sendEmail(emailData, "admin")
}

// Send confirmation email to customer
async function sendCustomerEmail(orderData: OrderSummary) {
  const customerEmailContent = formatCustomerEmail(orderData)

  const emailData = {
    to: orderData.customerInfo.email,
    subject: `Potvrda porudžbine - Sany Swings`,
    html: customerEmailContent,
    from: process.env.EMAIL_USER || "noreply@kidsswinghamaven.com"
  }

  return await sendEmail(emailData, "customer")
}

// Generic email sending function
async function sendEmail(emailData: any, recipient: string) {
  console.log(`Attempting to send ${recipient} email to:`, emailData.to)
  console.log("Email subject:", emailData.subject)

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    console.log("Making request to:", `${baseUrl}/api/send-email`)

    const response = await fetch(`${baseUrl}/api/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(emailData)
    })

    console.log(`${recipient} email response status:`, response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`${recipient} email error:`, errorText)

      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { message: errorText }
      }

      throw new Error(errorData.message || `HTTP ${response.status}: Failed to send ${recipient} email`)
    }

    const result = await response.json()
    console.log(`${recipient} email sent successfully:`, result)
    return result
  } catch (error) {
    console.error(`Error sending ${recipient} email:`, error)
    throw error
  }
}

// Save order to database
async function saveOrderToDatabase(orderData: OrderSummary) {
  console.log("Saving order to database...")

  // Prepare the items with product pricing
  const items = orderData.items.map(item => ({
    productId: item._id,
    quantity: item.quantity,
    price: item.salePrice || item.price
  }))

  const orderRequest = {
    user: orderData.customerInfo.fullName,
    userEmail: orderData.customerInfo.email,
    userPhone: orderData.customerInfo.phone,
    items: items
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    console.log("Making request to:", `${baseUrl}/api/orders`)

    const response = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderRequest)
    })

    console.log("Order creation response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Order creation error:", errorText)

      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { message: errorText }
      }

      throw new Error(errorData.message || `HTTP ${response.status}: Failed to save order`)
    }

    const result = await response.json()
    console.log("Order saved successfully:", result)
    return result
  } catch (error) {
    console.error("Error saving order to database:", error)
    throw error
  }
}