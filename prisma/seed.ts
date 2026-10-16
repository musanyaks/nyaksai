/**
 * Seed script — populates the Jumia-style store with products.
 * Image URLs are read from /tmp/imgsearch/N.json (results of z-ai image-search).
 * Falls back to a neutral SVG placeholder when a search result is missing.
 *
 * Run: bun prisma/seed.ts
 */
import { PrismaClient } from '@prisma/client'
import { readFileSync, existsSync } from 'fs'

const db = new PrismaClient()

const PLACEHOLDER =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><rect width='200' height='200' fill='%23f5f5f5'/><text x='100' y='108' font-family='Arial' font-size='18' font-weight='bold' fill='%23d0d0d0' text-anchor='middle'>JUMIA</text></svg>"

function imageFor(index: number): string {
  const file = `/tmp/imgsearch/${index}.json`
  if (existsSync(file)) {
    try {
      const data = JSON.parse(readFileSync(file, 'utf8'))
      const url = data?.results?.[0]?.original_url
      if (url && data?.success) return url
    } catch {
      /* fall through */
    }
  }
  return PLACEHOLDER
}

interface SeedProduct {
  slug: string
  name: string
  brand: string
  category: string
  price: number
  oldPrice?: number
  seller: string
  officialStore?: boolean
  express?: boolean
  flashSale?: boolean
  stockLeft?: number
  stockTotal?: number
  rating: number
  reviewCount: number
  freeDelivery?: boolean
}

/** query index in /tmp/imgsearch maps 1:1 to product order below */
const products: SeedProduct[] = [
  { slug: 'samsung-galaxy-a15', name: 'Samsung Galaxy A15 128GB Dual SIM - Awesome Blue', brand: 'Samsung', category: 'Phones & Tablets', price: 18500, oldPrice: 24500, seller: 'Samsung Official Store', officialStore: true, express: true, flashSale: true, stockLeft: 31, stockTotal: 120, rating: 4.6, reviewCount: 342, freeDelivery: true },
  { slug: 'iphone-13-128gb', name: 'Apple iPhone 13 128GB - Midnight', brand: 'Apple', category: 'Phones & Tablets', price: 89999, oldPrice: 109999, seller: 'Jumia Kenya', officialStore: true, express: true, rating: 4.8, reviewCount: 512 },
  { slug: 'tecno-spark-20-pro', name: 'Tecno Spark 20 Pro 256GB + 8GB RAM -Magic Skin', brand: 'Tecno', category: 'Phones & Tablets', price: 16499, oldPrice: 21999, seller: 'Tecno Official Store', officialStore: true, express: true, flashSale: true, stockLeft: 56, stockTotal: 150, rating: 4.4, reviewCount: 289 },
  { slug: 'infinix-hot-40i', name: 'Infinix Hot 40i 128GB + 4GB RAM - Starlit Black', brand: 'Infinix', category: 'Phones & Tablets', price: 13299, oldPrice: 15999, seller: 'Ortus Mobile', express: true, flashSale: true, stockLeft: 44, stockTotal: 100, rating: 4.3, reviewCount: 418 },
  { slug: 'redmi-13c', name: 'Xiaomi Redmi 13C 128GB + 6GB RAM - Navy Blue', brand: 'Xiaomi', category: 'Phones & Tablets', price: 14999, oldPrice: 17999, seller: 'TechHive Kenya', express: true, rating: 4.2, reviewCount: 156 },
  { slug: 'galaxy-tab-a9-plus', name: 'Samsung Galaxy Tab A9+ 11" 64GB WiFi - Graphite', brand: 'Samsung', category: 'Phones & Tablets', price: 24500, oldPrice: 29999, seller: 'Samsung Official Store', officialStore: true, rating: 4.5, reviewCount: 97, freeDelivery: true },
  { slug: 'hp-15s-core-i5', name: 'HP 15s Core i5 12th Gen 8GB 512GB SSD 15.6" Laptop', brand: 'HP', category: 'Computing', price: 62999, oldPrice: 74999, seller: 'HP Official Store', officialStore: true, express: true, flashSale: true, stockLeft: 12, stockTotal: 40, rating: 4.7, reviewCount: 134, freeDelivery: true },
  { slug: 'lenovo-ideapad-slim-3', name: 'Lenovo IdeaPad Slim 3 Ryzen 5 8GB 512GB 15.6" Laptop', brand: 'Lenovo', category: 'Computing', price: 54999, oldPrice: 64999, seller: 'TechHive Kenya', express: true, rating: 4.5, reviewCount: 88 },
  { slug: 'macbook-air-m1', name: 'Apple MacBook Air M1 13.3" 8GB 256GB SSD - Space Grey', brand: 'Apple', category: 'Computing', price: 119999, oldPrice: 145000, seller: 'Jumia Kenya', officialStore: true, rating: 4.9, reviewCount: 233, freeDelivery: true },
  { slug: 'samsung-43-smart-tv', name: 'Samsung 43" T5300 Full HD Smart Digital TVs', brand: 'Samsung', category: 'Television & Audio', price: 27999, oldPrice: 36999, seller: 'Samsung Official Store', officialStore: true, express: true, flashSale: true, stockLeft: 19, stockTotal: 80, rating: 4.6, reviewCount: 176, freeDelivery: true },
  { slug: 'tcl-50-4k-tv', name: 'TCL 50" P635 4K UHD Google TV - Android TV', brand: 'TCL', category: 'Television & Audio', price: 33499, oldPrice: 42999, seller: 'Vitron Electronics', express: true, rating: 4.4, reviewCount: 91 },
  { slug: 'jbl-go-3-speaker', name: 'JBL Go 3 Portable Bluetooth Speaker - IP67 Waterproof', brand: 'JBL', category: 'Television & Audio', price: 5499, oldPrice: 6999, seller: 'JBL Official Store', officialStore: true, flashSale: true, stockLeft: 67, stockTotal: 200, rating: 4.7, reviewCount: 405 },
  { slug: 'oraimo-freepods-4', name: 'Oraimo FreePods 4 ENC Wireless Earbuds 40H Playtime', brand: 'Oraimo', category: 'Electronics', price: 2999, oldPrice: 4499, seller: 'Oraimo Official Store', officialStore: true, express: true, flashSale: true, stockLeft: 89, stockTotal: 250, rating: 4.5, reviewCount: 533 },
  { slug: 'anker-powercore-20000', name: 'Anker PowerCore 20000mAh Power Bank 22.5W Fast Charge', brand: 'Anker', category: 'Electronics', price: 3899, oldPrice: 4999, seller: 'Anker Official Store', officialStore: true, express: true, rating: 4.8, reviewCount: 267 },
  { slug: 'logitech-g102-mouse', name: 'Logitech G102 Light Sync RGB Gaming Mouse 8000 DPI', brand: 'Logitech', category: 'Gaming', price: 2999, oldPrice: 3999, seller: 'TechHive Kenya', express: true, rating: 4.6, reviewCount: 145 },
  { slug: 'ramtons-blender-1-5l', name: 'Ramtons RM/580 1.5L 2-in-1 Blender with Grinder', brand: 'Ramtons', category: 'Appliances', price: 3499, oldPrice: 4599, seller: 'Ramtons Official Store', officialStore: true, express: true, flashSale: true, stockLeft: 38, stockTotal: 90, rating: 4.3, reviewCount: 211 },
  { slug: 'ramtons-microwave-20l', name: 'Ramtons 20L Digital Microwave Oven + Grill 700W', brand: 'Ramtons', category: 'Appliances', price: 9499, oldPrice: 11999, seller: 'Ramtons Official Store', officialStore: true, express: true, rating: 4.4, reviewCount: 78 },
  { slug: 'binatone-kettle', name: 'Binatone 1.7L Cordless Electric Kettle 2200W - Stainless', brand: 'Binatone', category: 'Appliances', price: 1599, oldPrice: 2299, seller: 'HomeEssentials', flashSale: true, stockLeft: 74, stockTotal: 160, rating: 4.1, reviewCount: 322 },
  { slug: 'hisense-fridge-265l', name: 'Hisense 265L Double Door Refrigerator Frost Free - Silver', brand: 'Hisense', category: 'Appliances', price: 54999, oldPrice: 69999, seller: 'Vitron Electronics', express: true, rating: 4.5, reviewCount: 42, freeDelivery: true },
  { slug: 'nasco-gas-cooker', name: 'Nasco 4 Burner Gas Cooker with Oven + Grill 60x60', brand: 'Nasco', category: 'Appliances', price: 22999, oldPrice: 28999, seller: 'HomeEssentials', express: true, rating: 4.2, reviewCount: 65, freeDelivery: true },
  { slug: 'ergonomic-office-chair', name: 'Ergonomic Mesh Office Chair with Lumbar Support + Armrest', brand: 'Fenglin', category: 'Home & Office', price: 8499, oldPrice: 11999, seller: 'OfficePoint Kenya', express: true, flashSale: true, stockLeft: 25, stockTotal: 70, rating: 4.3, reviewCount: 119 },
  { slug: 'mens-running-sneakers', name: "Men's Lightweight Running Sneakers Breathable Sports Shoes", brand: 'adidas', category: 'Sporting Goods', price: 2999, oldPrice: 4999, seller: 'UrbanKicks', express: true, flashSale: true, stockLeft: 47, stockTotal: 130, rating: 4.4, reviewCount: 287 },
  { slug: 'womens-leather-handbag', name: "Women's Premium Leather Handbag Shoulder Tote Bag", brand: 'Zakara', category: 'Fashion', price: 2199, oldPrice: 3499, seller: 'Bella Moda', rating: 4.2, reviewCount: 98 },
  { slug: 'smartwatch-fitness', name: 'Smart Watch Fitness Tracker 1.9" HD Screen - IP68 Waterproof', brand: 'Oraimo', category: 'Electronics', price: 1999, oldPrice: 3499, seller: 'Oraimo Official Store', officialStore: true, express: true, flashSale: true, stockLeft: 93, stockTotal: 220, rating: 4.4, reviewCount: 476 },
  { slug: 'mens-quartz-watch', name: "Men's Classic Quartz Wrist Watch Stainless Steel - Black", brand: 'Casio', category: 'Fashion', price: 1499, oldPrice: 2799, seller: 'TimeCenter', rating: 4.1, reviewCount: 64 },
  { slug: 'perfume-100ml', name: 'Versace Pour Homme EDT Perfume 100ml For Men', brand: 'Versace', category: 'Health & Beauty', price: 8999, oldPrice: 11999, seller: 'BeautyHub Kenya', officialStore: true, express: true, rating: 4.7, reviewCount: 133 },
  { slug: 'hair-dryer-2000w', name: 'Professional Hair Dryer 2000W Ionic Styler - Hot & Cold', brand: 'Sokany', category: 'Health & Beauty', price: 1899, oldPrice: 2999, seller: 'BeautyHub Kenya', express: true, flashSale: true, stockLeft: 58, stockTotal: 140, rating: 4.2, reviewCount: 187 },
  { slug: 'white-rice-5kg', name: 'Pishori White Rice 5KG Pack - Premium Quality', brand: 'Tamu', category: 'Supermarket', price: 899, oldPrice: 1099, seller: 'Jumia Supermarket', express: true, rating: 4.3, reviewCount: 254 },
  { slug: 'cooking-oil-5l', name: 'Salit Cooking Oil 5L - Cholesterol Free', brand: 'Salit', category: 'Supermarket', price: 1299, oldPrice: 1499, seller: 'Jumia Supermarket', express: true, rating: 4.5, reviewCount: 311 },
  { slug: 'baby-diapers-80pcs', name: 'Pampers Baby Dry Diapers Jumbo Pack 80pcs Size 4', brand: 'Pampers', category: 'Baby Products', price: 2199, oldPrice: 2799, seller: 'Jumia Supermarket', express: true, flashSale: true, stockLeft: 61, stockTotal: 150, rating: 4.8, reviewCount: 389 },
]

async function main() {
  console.log('Seeding products…')
  await db.product.deleteMany({})

  for (let i = 0; i < products.length; i++) {
    const p = products[i]
    const image = imageFor(i + 1)
    await db.product.create({
      data: {
        slug: p.slug,
        name: p.name,
        brand: p.brand,
        category: p.category,
        price: p.price,
        oldPrice: p.oldPrice ?? null,
        image,
        seller: p.seller,
        officialStore: p.officialStore ?? false,
        express: p.express ?? false,
        flashSale: p.flashSale ?? false,
        stockLeft: p.stockLeft ?? 0,
        stockTotal: p.stockTotal ?? 0,
        rating: p.rating,
        reviewCount: p.reviewCount,
        freeDelivery: p.freeDelivery ?? false,
      },
    })
    if (image !== PLACEHOLDER) {
      console.log(`  ✓ ${p.slug} → ${image.slice(0, 72)}…`)
    } else {
      console.log(`  ! ${p.slug} → placeholder (no image found)`)
    }
  }

  const count = await db.product.count()
  console.log(`Done. ${count} products in DB.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
