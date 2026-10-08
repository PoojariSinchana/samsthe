Samsthe
Business Management Software Platform for small and growing businesses.
Samsthe is a multi-business management platform designed to help businesses manage daily operations, sales, purchases, inventory, customers, suppliers, staff, finance, accounting, reports, and analytics from one place.
Features
- Multi-business application platform
- Restaurant management
- Retail / shop management
- Clothing shop management
- Business dashboard
- POS and billing
- Sales and purchases
- Inventory and stock management
- Customers and suppliers
- Staff and role management
- Partners
- Bank and cash management
- Loans and budgets
- Accounting and reports
- Business analytics
- Admin management
- Subscription and payment management
- Progressive Web App (PWA) support
Technology Stack
Frontend
- React.js
- Vite
- JavaScript
- HTML5
- CSS3
Backend
- Node.js
- Express.js
- REST API
Database
- MongoDB
- Mongoose
Security
- JWT authentication
- Helmet
- CORS
- Rate limiting
- Environment variables
Payments
- Razorpay
Project Structure
samsthe/
├── backend/
│   ├── config/
│   ├── modules/
│   │   ├── admin/
│   │   └── restaurant/
│   ├── shared/
│   │   ├── constants/
│   │   ├── controllers/
│   │   ├── jobs/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   └── uploads/
│   ├── app.js
│   ├── server.js
│   └── package.json
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.js
│
├── .gitignore
├── package.json
└── README.md
Requirements
Install the following before running the project:
- Node.js 20+
- npm
- MongoDB
- Git
Installation
Clone the repository:
git clone <YOUR_REPOSITORY_URL>
cd samsthe
Install root dependencies:
npm install
Install backend dependencies:
cd backend
npm install
Install frontend dependencies:
cd ../frontend
npm install
Return to the project root:
cd ..
Environment Variables
Create a .env file inside the backend folder.
PORT=5000

MONGODB_URI=mongodb://localhost:27017/samsthe_db

JWT_SECRET=your_secure_jwt_secret

RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret
Never commit .env or any secret credentials to Git.
Use .env.example for sharing the required environment variable names without real credentials.
Database
Samsthe uses MongoDB.
Default local database:
mongodb://localhost:27017/samsthe_db
Make sure MongoDB is running before starting the backend.
Running the Application
From the project root:
npm run dev
The development environment starts the frontend and backend.
Backend:
http://localhost:5000
Frontend:
http://localhost:5173
The frontend port may change if the default port is already in use.
Production Build
Build the frontend:
cd frontend
npm run build
Run the backend in production mode.
Windows PowerShell:
cd ../backend
$env:NODE_ENV="production"
node server.js
Progressive Web App
Samsthe supports Progressive Web App functionality.
After deploying the production build, supported browsers can provide an option to install Samsthe as an application on desktop or mobile devices.
Authentication
The platform supports secure business authentication including:
- User registration
- User login
- Staff login
- JWT-based authentication
- Role-based access
- Business-based access
- Password management
- Protected API routes
User Roles
Business access can be controlled using roles such as:
- Owner
- Manager
- Staff
Permissions can be configured according to the business and user's responsibilities.
Restaurant Management
The restaurant application is designed to support:
- Dashboard
- POS / Billing
- Orders
- Tables
- Sales
- Purchases
- Inventory
- Customers
- Suppliers
- Staff
- Partners
- Bank & Cash
- Loans
- Budget
- Accounting
- Reports
- Analytics
- Settings
Restaurant table statuses include:
- Free
- Busy
- Reserved
- Cleaning
Sales channels can include:
- Dine-in
- Takeaway
- Zomato
- Swiggy
- Own online orders
- Other channels
Retail Management
The retail application is designed to support:
- Products
- Categories
- Inventory
- Stock
- Purchases
- Sales
- Customers
- Suppliers
- Staff
- Expenses
- Income
- Reports
- Analytics
Finance & Accounting
Financial management features include:
- Income tracking
- Expense tracking
- Asset management
- Inventory value
- Bank and cash management
- Loans
- Budgeting
- Accounting
- Financial reports
- Business analytics
Admin System
The Samsthe admin system is designed to manage the software business.
Admin functionality includes:
- Admin authentication
- Dashboard
- Leads
- Clients
- Plans
- Subscriptions
- Invoices
- Payments
- Application management
Subscriptions & Payments
Samsthe is designed as a subscription-based SaaS platform.
Planned subscription features include:
- Free trial
- Monthly plans
- Yearly plans
- Plus
- Pro
- Promax
- Payment processing
- Subscription management
- Invoices
- Payment records
- Razorpay webhooks
API Architecture
Samsthe uses REST APIs with shared and application-specific modules.
Example API areas:
/api/auth
/api/business
/api/outlets
/api/staff
/api/customers
/api/suppliers
/api/products
/api/inventory
/api/sales
/api/purchases
/api/admin
Application-specific APIs can be maintained separately from shared business functionality.
Security
Security practices include:
- JWT authentication
- Password hashing
- HTTP security headers
- CORS protection
- Rate limiting
- Environment variables
- Protected API routes
- Role-based authorization
- Payment webhook verification
Never store production credentials directly in source code.
Development Workflow
Recommended development workflow:
Development
     ↓
Testing
     ↓
Production Build
     ↓
Preview / Staging
     ↓
Production
Database changes should be handled carefully when existing production businesses depend on the database structure.
Deployment
Samsthe can be deployed to Node.js-compatible infrastructure such as:
- Railway
- VPS
- Dedicated server
- Other cloud hosting providers
A production deployment should include:
- HTTPS
- Production MongoDB
- Secure environment variables
- Production payment credentials
- Proper CORS configuration
- Database backups
- Monitoring
- Error logging
Roadmap
Current / Core
- [x] Backend foundation
- [x] MongoDB integration
- [x] Authentication architecture
- [x] Restaurant management
- [x] Admin system
- [x] Subscription architecture
Planned
- [ ] Retail management
- [ ] Clothing shop management
- [ ] Advanced inventory
- [ ] Advanced accounting
- [ ] Complete payment flow
- [ ] Automated invoices
- [ ] Multi-outlet improvements
- [ ] AI-powered business assistance
- [ ] Advanced analytics
- [ ] Automated reports
- [ ] Business notifications
- [ ] Production SaaS onboarding
License
This project is proprietary software.
Unauthorized copying, redistribution, or commercial use is not permitted without permission from the owner.
Developer
Sinchana Poojari
Samsthe
Business Management Software Platform
Project Status
Samsthe is under active development.
Features, APIs, database structures, and application modules may change as the platform evolves.