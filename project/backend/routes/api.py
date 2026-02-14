"""
REST API routes consumed by the React / mobile front-end.
"""
import os
import uuid
from datetime import datetime

from flask import Blueprint, request, jsonify, current_app, url_for
from werkzeug.utils import secure_filename
import jwt

from db import get_mongodb_db
from middleware import token_required
from helpers import allowed_file, MAX_FILE_SIZE, send_system_email, build_email_html, generate_receipt_pdf
from lalamove import create_delivery_order, get_delivery_status
from paymongo import create_checkout_session, PayMongoError, verify_webhook_signature, get_checkout_session

api_bp = Blueprint('api', __name__, url_prefix='/api')

_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # routes/ -> backend/
UPLOAD_FOLDER = os.path.join(_BACKEND_DIR, 'static', 'uploads', 'profiles')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def _get_paymongo_redirect_urls():
    origin = (request.headers.get('Origin') or '').rstrip('/')
    success_url = (os.environ.get('PAYMONGO_SUCCESS_URL') or '').strip()
    cancel_url = (os.environ.get('PAYMONGO_CANCEL_URL') or '').strip()

    if not success_url and origin:
        success_url = f'{origin}/orders'
    if not cancel_url and origin:
        cancel_url = f'{origin}/cart'

    return success_url, cancel_url


def _finalize_paid_order(db, order_doc):
    from bson import ObjectId

    items = order_doc.get('items', [])
    for item in items:
        product_id = item.get('product_id')
        qty = int(item.get('quantity', 1))
        if not product_id:
            continue
        try:
            if ObjectId.is_valid(str(product_id)):
                db.products.update_one({'_id': ObjectId(str(product_id))}, {'$inc': {'quantity': -qty}})
            else:
                db.products.update_one({'id': str(product_id)}, {'$inc': {'quantity': -qty}})
        except Exception:
            pass

    try:
        product_ids = [str(item.get('product_id')) for item in items if item.get('product_id')]
        if product_ids:
            db.carts.update_one(
                {'user_id': order_doc.get('user_id')},
                {'$pull': {'items': {'product_id': {'$in': product_ids}}}},
            )
    except Exception:
        pass

    try:
        user_doc = db.users.find_one({'id': order_doc.get('user_id')})
        if not user_doc:
            user_doc = db.users.find_one({'_id': order_doc.get('user_id')})

        buyer_email = user_doc.get('email') if user_doc else None
        shipping_name = order_doc.get('shipping_name') or (user_doc.get('first_name') if user_doc else '')
        order_id = str(order_doc.get('_id'))
        total_amount = float(order_doc.get('total_amount', 0) or 0)

        if buyer_email:
            receipt_pdf = generate_receipt_pdf(order_id, shipping_name, buyer_email, items, total_amount)
            email_html = build_email_html(
                title="Payment Confirmed",
                subtitle="Your payment was received",
                badge_text="PAID",
                content_html=(
                    f"<p>Hi {shipping_name},</p>"
                    "<p>Your payment has been confirmed and your order is now pending seller approval.</p>"
                    f'<div style="background:#f3f4f6;padding:12px 14px;border-radius:10px;">'
                    f"<strong>Order ID:</strong> {order_id}</div>"
                    "<p style='margin-top:12px;'>Thank you for shopping with FarmtoClick.</p>"
                ),
            )
            send_system_email(
                current_app,
                buyer_email,
                "FarmtoClick Payment Confirmed",
                f"Order ID: {order_id}\nTotal: {total_amount}",
                html_body=email_html,
                attachments=[{
                    'filename': f"FarmtoClick-Receipt-{order_id}.pdf",
                    'content': receipt_pdf,
                    'maintype': 'application',
                    'subtype': 'pdf',
                }],
            )
    except Exception as e:
        print(f"Payment confirmation email error: {e}")


def _paymongo_session_paid(session):
    if not isinstance(session, dict):
        return False, None
    attrs = session.get('attributes', {})
    status = (attrs.get('payment_status') or attrs.get('status') or '').lower()
    if status in ('paid', 'succeeded', 'complete', 'completed'):
        payment_id = attrs.get('payment_intent_id') or attrs.get('payment_id')
        return True, payment_id

    payments = attrs.get('payments') or []
    for payment in payments:
        if not isinstance(payment, dict):
            continue
        p_attrs = payment.get('attributes', {})
        p_status = (p_attrs.get('status') or p_attrs.get('payment_status') or '').lower()
        if p_status in ('paid', 'succeeded', 'complete', 'completed'):
            payment_id = p_attrs.get('id') or payment.get('id')
            return True, payment_id

    return False, None


# ------------------------------------------------------------------
# Auth
# ------------------------------------------------------------------
@api_bp.route('/auth/login', methods=['POST'])
def api_login():
    try:
        data = request.get_json()
        if not data or not data.get('email') or not data.get('password'):
            return jsonify({'error': 'Email and password are required'}), 400

        from user_model import User
        db, _ = get_mongodb_db(api_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500

        user = User.get_by_email(db, data['email'])
        if user and user.check_password(data['password']):
            token = jwt.encode(
                {
                    'user_id': str(user.id),
                    'email': user.email,
                    'exp': datetime.utcnow() + current_app.config['JWT_ACCESS_TOKEN_EXPIRE'],
                },
                current_app.config['JWT_SECRET_KEY'],
                algorithm='HS256',
            )
            return jsonify({
                'token': token,
                'user': {
                    'id': str(user.id),
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'phone': getattr(user, 'phone', ''),
                    'role': user.role,
                    'is_admin': user.role == 'admin',
                    'is_farmer': user.role == 'farmer',
                    'is_rider': user.role == 'rider',
                    'profile_picture': user.profile_picture,
                    'overall_location': getattr(user, 'overall_location', ''),
                    'shipping_address': getattr(user, 'shipping_address', ''),
                },
            })

        return jsonify({'error': 'Invalid credentials'}), 401
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/auth/register', methods=['POST'])
def api_register():
    try:
        data = request.get_json()
        required = ['email', 'password', 'first_name', 'last_name']
        if not all(f in data for f in required):
            return jsonify({'error': 'Missing required fields'}), 400

        from user_model import User
        db, _ = get_mongodb_db(api_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500

        if User.get_by_email(db, data['email']):
            return jsonify({'error': 'User already exists'}), 409

        user = User(
            email=data['email'],
            first_name=data['first_name'],
            last_name=data['last_name'],
            phone=data.get('phone', ''),
            role=data.get('role', 'user'),
        )
        user.set_password(data['password'])
        user.save(db)

        token = jwt.encode(
            {
                'user_id': str(user.id),
                'email': user.email,
                'exp': datetime.utcnow() + current_app.config['JWT_ACCESS_TOKEN_EXPIRE'],
            },
            current_app.config['JWT_SECRET_KEY'],
            algorithm='HS256',
        )
        return jsonify({
            'token': token,
            'user': {
                'id': str(user.id),
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'phone': getattr(user, 'phone', ''),
                'role': user.role,
                'is_admin': user.role == 'admin',
                'is_farmer': user.role == 'farmer',
                'is_rider': user.role == 'rider',
                'profile_picture': user.profile_picture,
                'overall_location': getattr(user, 'overall_location', ''),
                'shipping_address': getattr(user, 'shipping_address', ''),
            },
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ------------------------------------------------------------------
# Products
# ------------------------------------------------------------------
@api_bp.route('/products', methods=['GET'])
def api_products():
    try:
        db, _ = get_mongodb_db(api_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500

        # Only include products visible to customers (either no audience set or audience includes 'customers')
        products_cursor = db.products.find({
            'available': True,
            '$or': [
                {'audience': {'$exists': False}},
                {'audience': 'customers'}
            ]
        }).sort('created_at', -1)
        products = []
        from bson import ObjectId
        for p in products_cursor:
            # attempt to resolve farmer display name from product doc or users collection
            farmer_name = p.get('farmer_name', '')
            farmer_info = None
            if not farmer_name:
                # possible farmer id fields
                possible_ids = [p.get(k) for k in ('farmer', 'farmer_user_id', 'farmer_id', 'farmerId', 'seller_id', 'sellerId') if p.get(k)]
                found = None
                for fid in possible_ids:
                    try:
                        if ObjectId.is_valid(str(fid)):
                            found = db.users.find_one({'_id': ObjectId(str(fid))})
                        else:
                            found = db.users.find_one({'id': str(fid)}) or db.users.find_one({'email': str(fid)})
                    except Exception:
                        found = db.users.find_one({'id': str(fid)})
                    if found:
                        break
                if found:
                    farmer_name = f"{found.get('first_name','').strip()} {found.get('last_name','').strip()}".strip() or found.get('farm_name') or found.get('name') or ''
                    farmer_info = {
                        'id': str(found.get('_id') or found.get('id') or ''),
                        'farm_name': found.get('farm_name', ''),
                        'name': farmer_name,
                        'location': found.get('farm_location') or found.get('overall_location') or found.get('location') or ''
                    }

            products.append({
                'id': str(p.get('_id', '')),
                'name': p.get('name', ''),
                'description': p.get('description', ''),
                'price': p.get('price', 0),
                'image': p.get('image', ''),
                'image_url': p.get('image_url', '') if p.get('image_url') else '',
                'farmer_name': farmer_name or '',
                'farmer': farmer_info,
                'category': p.get('category', ''),
                'quantity': p.get('quantity', 0),
                'unit': p.get('unit', ''),
                'location': p.get('location', ''),
            })
        return jsonify(products)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/products/<product_id>', methods=['GET'])
def api_product_detail(product_id):
    try:
        from bson import ObjectId
        db, _ = get_mongodb_db(api_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500

        product = db.products.find_one({'_id': ObjectId(product_id)})
        if not product:
            return jsonify({'error': 'Product not found'}), 404

        from bson import ObjectId
        # resolve farmer name if not present
        farmer_name = product.get('farmer_name', '')
        farmer_info = None
        if not farmer_name:
            possible_ids = [product.get(k) for k in ('farmer', 'farmer_user_id', 'farmer_id', 'farmerId', 'seller_id', 'sellerId') if product.get(k)]
            found = None
            for fid in possible_ids:
                try:
                    if ObjectId.is_valid(str(fid)):
                        found = db.users.find_one({'_id': ObjectId(str(fid))})
                    else:
                        found = db.users.find_one({'id': str(fid)}) or db.users.find_one({'email': str(fid)})
                except Exception:
                    found = db.users.find_one({'id': str(fid)})
                if found:
                    break
            if found:
                farmer_name = f"{found.get('first_name','').strip()} {found.get('last_name','').strip()}".strip() or found.get('farm_name') or found.get('name') or ''
                farmer_info = {
                    'id': str(found.get('_id') or found.get('id') or ''),
                    'farm_name': found.get('farm_name', ''),
                    'name': farmer_name,
                    'location': found.get('farm_location') or found.get('overall_location') or found.get('location') or ''
                }

        return jsonify({
            'id': str(product['_id']),
            'name': product.get('name', ''),
            'description': product.get('description', ''),
            'price': product.get('price', 0),
            'image': product.get('image', ''),
            'image_url': product.get('image_url', '') if product.get('image_url') else '',
            'farmer_name': farmer_name or '',
            'farmer': farmer_info,
            'category': product.get('category', ''),
            'quantity': product.get('quantity', 0),
            'unit': product.get('unit', ''),
            'location': product.get('location', ''),
            'farmer_id': str(product.get('farmer_id', '')),
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ------------------------------------------------------------------
# User profile
# ------------------------------------------------------------------
@api_bp.route('/user/profile', methods=['GET'], endpoint='api_user_profile')
@token_required
def api_user_profile():
    try:
        from user_model import User
        db, _ = get_mongodb_db(api_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500

        user = User.get_by_email(db, request.user_email)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        return jsonify({
            'id': str(user.id),
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'phone': user.phone,
            'role': user.role,
            'is_admin': user.role == 'admin',
            'is_farmer': user.role == 'farmer',
            'profile_picture': user.profile_picture,
            'farm_name': getattr(user, 'farm_name', ''),
            'farm_location': getattr(user, 'farm_location', ''),
            'overall_location': getattr(user, 'overall_location', ''),
            'shipping_address': getattr(user, 'shipping_address', ''),
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/user/profile', methods=['PUT'], endpoint='api_update_profile')
@token_required
def api_update_profile():
    try:
        from user_model import User
        db, _ = get_mongodb_db(api_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500

        user = User.get_by_email(db, request.user_email)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        if request.content_type and 'multipart/form-data' in request.content_type:
            data = request.form.to_dict()
        else:
            data = request.get_json() or {}

        for field in ('first_name', 'last_name', 'phone', 'overall_location', 'shipping_address'):
            if field in data:
                setattr(user, field, data[field])

        if getattr(user, 'role', 'user') == 'farmer':
            for field in ('farm_name', 'farm_phone', 'farm_location', 'farm_description'):
                if field in data:
                    setattr(user, field, data[field])

        # Profile picture
        remove_picture = data.get('remove_profile_picture') == '1'
        profile_picture = request.files.get('profile_picture')

        if remove_picture:
            if hasattr(user, 'profile_picture') and user.profile_picture:
                old = os.path.join(UPLOAD_FOLDER, user.profile_picture)
                if os.path.exists(old):
                    os.remove(old)
                user.profile_picture = None
        elif profile_picture and profile_picture.filename:
            if allowed_file(profile_picture.filename):
                profile_picture.seek(0, os.SEEK_END)
                fsize = profile_picture.tell()
                profile_picture.seek(0)
                if fsize > MAX_FILE_SIZE:
                    return jsonify({'error': 'Profile picture must be less than 5MB'}), 400

                filename = secure_filename(profile_picture.filename)
                unique = f"{uuid.uuid4().hex}_{filename}"
                profile_picture.save(os.path.join(UPLOAD_FOLDER, unique))

                if hasattr(user, 'profile_picture') and user.profile_picture:
                    old = os.path.join(UPLOAD_FOLDER, user.profile_picture)
                    if os.path.exists(old):
                        os.remove(old)
                user.profile_picture = unique
            else:
                return jsonify({'error': 'Invalid file type. Use JPG, PNG, GIF, or WebP.'}), 400

        # Password change
        current_password = data.get('current_password', '')
        new_password = data.get('new_password', '')
        if new_password:
            if not current_password:
                return jsonify({'error': 'Current password is required'}), 400
            if not user.check_password(current_password):
                return jsonify({'error': 'Current password is incorrect'}), 400
            if len(new_password) < 6:
                return jsonify({'error': 'Password must be at least 6 characters'}), 400
            user.set_password(new_password)

        user.save(db)

        return jsonify({
            'message': 'Profile updated successfully',
            'user': {
                'id': str(user._id) if hasattr(user, '_id') else user.email,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'phone': getattr(user, 'phone', ''),
                'role': getattr(user, 'role', 'user'),
                'is_admin': getattr(user, 'role', 'user') == 'admin',
                'is_farmer': getattr(user, 'role', 'user') == 'farmer',
                'profile_picture': getattr(user, 'profile_picture', None),
                'overall_location': getattr(user, 'overall_location', ''),
                'shipping_address': getattr(user, 'shipping_address', ''),
                'farm_name': getattr(user, 'farm_name', ''),
                'farm_phone': getattr(user, 'farm_phone', ''),
                'farm_location': getattr(user, 'farm_location', ''),
                'farm_description': getattr(user, 'farm_description', ''),
            },
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/user/notifications', methods=['GET'])
@token_required
def api_user_notifications():
    try:
        db, _ = get_mongodb_db(api_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500

        # Fetch recent notifications for the logged-in user
        cursor = db.notifications.find({'user_email': request.user_email}).sort('created_at', -1).limit(50)
        notifs = []
        for n in cursor:
            created_at = n.get('created_at')
            created_at_iso = created_at.isoformat() if hasattr(created_at, 'isoformat') else (created_at if created_at else None)
            notifs.append({
                'id': str(n.get('_id')),
                'subject': n.get('subject', ''),
                'message': n.get('message', ''),
                'read': bool(n.get('read', False)),
                'created_at': created_at_iso
            })
        return jsonify(notifs)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/user/notifications/<notif_id>/read', methods=['POST'])
@token_required
def api_mark_notification_read(notif_id):
    try:
        from bson.objectid import ObjectId

        db, _ = get_mongodb_db(api_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500

        try:
            oid = ObjectId(notif_id)
        except Exception:
            return jsonify({'error': 'Invalid notification id'}), 400

        res = db.notifications.update_one({'_id': oid, 'user_email': request.user_email}, {'$set': {'read': True}})
        if res.matched_count == 0:
            return jsonify({'error': 'Notification not found'}), 404
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ------------------------------------------------------------------
# Cart
# ------------------------------------------------------------------
@api_bp.route('/cart', methods=['GET'])
@token_required
def api_get_cart():
    try:
        from bson import ObjectId

        db, _ = get_mongodb_db(api_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500

        cart_doc = db.carts.find_one({'user_id': request.user_id})
        items = []
        total = 0.0

        if cart_doc:
            for item in cart_doc.get('items', []):
                product_id = item.get('product_id')
                product = None
                if product_id and ObjectId.is_valid(product_id):
                    product = db.products.find_one({'_id': ObjectId(product_id)})
                if not product:
                    product = db.products.find_one({'id': product_id})

                if not product:
                    continue

                qty = int(item.get('quantity', 1))
                price = float(product.get('price', 0) or 0)

                farmer = None
                farmer_ref = product.get('farmer') or product.get('farmer_id') or product.get('farmer_user_id')
                if farmer_ref:
                    farmer_doc = db.users.find_one({'id': str(farmer_ref)})
                    if not farmer_doc and ObjectId.is_valid(str(farmer_ref)):
                        farmer_doc = db.users.find_one({'_id': ObjectId(str(farmer_ref))})
                    if farmer_doc:
                        farmer = {
                            'full_name': f"{farmer_doc.get('first_name', '')} {farmer_doc.get('last_name', '')}".strip(),
                            'farm_name': farmer_doc.get('farm_name', ''),
                        }

                items.append({
                    'product': {
                        'id': str(product.get('_id', product_id)),
                        'name': product.get('name', ''),
                        'price': price,
                        'unit': product.get('unit', ''),
                        'quantity': product.get('quantity', 0),
                        'image_url': product.get('image_url', '') or product.get('image', ''),
                        'farmer': farmer,
                    },
                    'quantity': qty,
                    'subtotal': price * qty,
                })
                total += price * qty

        return jsonify({'items': items, 'total': total})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/cart', methods=['POST'])
@token_required
def api_add_to_cart():
    try:
        from bson import ObjectId

        data = request.get_json() or {}
        product_id = str(data.get('product_id', '')).strip()
        quantity = int(data.get('quantity', 1) or 1)

        if not product_id or quantity < 1:
            return jsonify({'error': 'Invalid product or quantity'}), 400

        db, _ = get_mongodb_db(api_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500

        product = None
        if ObjectId.is_valid(product_id):
            product = db.products.find_one({'_id': ObjectId(product_id)})
        if not product:
            product = db.products.find_one({'id': product_id})
        if not product:
            return jsonify({'error': 'Product not found'}), 404

        cart_doc = db.carts.find_one({'user_id': request.user_id})
        if cart_doc:
            existing = next(
                (i for i in cart_doc.get('items', []) if i.get('product_id') == product_id),
                None,
            )
            if existing:
                db.carts.update_one(
                    {'_id': cart_doc['_id'], 'items.product_id': product_id},
                    {'$inc': {'items.$.quantity': quantity}},
                )
            else:
                db.carts.update_one(
                    {'_id': cart_doc['_id']},
                    {'$push': {'items': {'product_id': product_id, 'quantity': quantity}}},
                )
        else:
            db.carts.insert_one({
                'user_id': request.user_id,
                'items': [{'product_id': product_id, 'quantity': quantity}],
            })

        return jsonify({'message': 'Product added to cart'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/cart/<product_id>', methods=['PUT'])
@token_required
def api_update_cart_item(product_id):
    try:
        data = request.get_json() or {}
        quantity = int(data.get('quantity', 1) or 1)

        db, _ = get_mongodb_db(api_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500

        if quantity < 1:
            db.carts.update_one(
                {'user_id': request.user_id},
                {'$pull': {'items': {'product_id': product_id}}},
            )
            return jsonify({'message': 'Item removed from cart'})

        db.carts.update_one(
            {'user_id': request.user_id, 'items.product_id': product_id},
            {'$set': {'items.$.quantity': quantity}},
        )
        return jsonify({'message': 'Cart updated'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/cart/<product_id>', methods=['DELETE'])
@token_required
def api_remove_cart_item(product_id):
    try:
        db, _ = get_mongodb_db(api_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500

        db.carts.update_one(
            {'user_id': request.user_id},
            {'$pull': {'items': {'product_id': product_id}}},
        )
        return jsonify({'message': 'Item removed from cart'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/cart', methods=['DELETE'])
@token_required
def api_clear_cart():
    try:
        db, _ = get_mongodb_db(api_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500

        db.carts.delete_one({'user_id': request.user_id})
        return jsonify({'message': 'Cart cleared'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ------------------------------------------------------------------
# Orders
# ------------------------------------------------------------------
@api_bp.route('/orders', methods=['GET'])
@token_required
def api_get_orders():
    try:
        from bson import ObjectId
        db, _ = get_mongodb_db(api_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500

        orders = list(db.orders.find({'user_id': request.user_id}).sort('created_at', -1))
        for order in orders:
            order['_id'] = str(order.get('_id'))
            order.setdefault('delivery_status', order.get('status', 'pending'))
            order.setdefault('delivery_tracking_id', None)
            order.setdefault('delivery_updates', [])
            order.setdefault('logistics_provider', 'lalamove')
            order.setdefault('assigned_rider_id', None)
            order.setdefault('assigned_rider_name', None)
            order.setdefault('assigned_rider_phone', None)
            order.setdefault('assigned_rider_barangay', None)
            order.setdefault('assigned_rider_city', None)
            order.setdefault('assigned_rider_province', None)

            if order.get('payment_provider') == 'paymongo' and order.get('payment_status') != 'paid':
                checkout_id = order.get('paymongo_checkout_id')
                if checkout_id:
                    try:
                        session = get_checkout_session(checkout_id)
                        is_paid, payment_id = _paymongo_session_paid(session)
                        if is_paid:
                            update_fields = {
                                'payment_status': 'paid',
                                'paid_at': datetime.utcnow(),
                                'updated_at': datetime.utcnow(),
                            }
                            if payment_id:
                                update_fields['paymongo_payment_id'] = payment_id
                            db.orders.update_one({'_id': ObjectId(order['_id'])}, {'$set': update_fields})
                            order['payment_status'] = 'paid'
                            _finalize_paid_order(db, order)
                    except Exception:
                        pass
        return jsonify(orders)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/paymongo/confirm', methods=['POST'])
@token_required
def api_paymongo_confirm():
    try:
        from bson import ObjectId

        data = request.get_json() or {}
        order_id = (data.get('order_id') or '').strip()
        if not order_id:
            return jsonify({'error': 'Order id is required'}), 400

        db, _ = get_mongodb_db(api_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500

        order_filter = {'_id': ObjectId(order_id)} if ObjectId.is_valid(order_id) else {'_id': order_id}
        order_doc = db.orders.find_one(order_filter)
        if not order_doc:
            return jsonify({'error': 'Order not found'}), 404

        if order_doc.get('user_id') != request.user_id:
            return jsonify({'error': 'Not authorized'}), 403

        if order_doc.get('payment_provider') != 'paymongo':
            return jsonify({'error': 'Order is not PayMongo'}), 400

        if order_doc.get('payment_status') == 'paid':
            return jsonify({'status': 'paid'}), 200

        checkout_id = order_doc.get('paymongo_checkout_id')
        if not checkout_id:
            return jsonify({'error': 'Checkout session not found'}), 400

        session = get_checkout_session(checkout_id)
        is_paid, payment_id = _paymongo_session_paid(session)
        if is_paid:
            update_fields = {
                'payment_status': 'paid',
                'paid_at': datetime.utcnow(),
                'updated_at': datetime.utcnow(),
            }
            if payment_id:
                update_fields['paymongo_payment_id'] = payment_id
            db.orders.update_one(order_filter, {'$set': update_fields})
            _finalize_paid_order(db, order_doc)
            return jsonify({'status': 'paid'}), 200

        return jsonify({'status': 'pending'}), 200
    except PayMongoError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/rider/orders', methods=['GET'])
@token_required
def api_get_rider_orders():
    try:
        from user_model import User

        db, _ = get_mongodb_db(api_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500

        user = User.get_by_email(db, request.user_email)
        if not user or getattr(user, 'role', 'user') != 'rider':
            return jsonify({'error': 'Not authorized'}), 403

        rider_doc = db.riders.find_one({'user_id': str(user.id)})
        if not rider_doc:
            rider_doc = db.riders.find_one({'email': user.email})
        if not rider_doc:
            return jsonify({'error': 'Rider profile not found'}), 404

        assigned_id = str(rider_doc.get('_id'))
        orders = list(db.orders.find({'assigned_rider_id': assigned_id}).sort('created_at', -1))

        results = []
        for order in orders:
            buyer = db.users.find_one({'id': order.get('user_id')})
            results.append({
                'id': str(order.get('_id')),
                'status': order.get('status', 'pending'),
                'delivery_status': order.get('delivery_status', order.get('status', 'pending')),
                'delivery_tracking_id': order.get('delivery_tracking_id'),
                'created_at': order.get('created_at'),
                'buyer_name': buyer.get('first_name') if buyer else 'Customer',
                'buyer_phone': buyer.get('phone') if buyer else '',
                'shipping_name': order.get('shipping_name'),
                'shipping_phone': order.get('shipping_phone'),
                'shipping_address': order.get('shipping_address'),
                'delivery_address': order.get('delivery_address'),
                'delivery_notes': order.get('delivery_notes'),
                'items': order.get('items', []),
                'total_amount': order.get('total_amount', 0),
            })

        return jsonify({'orders': results})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/rider/orders/<order_id>/status', methods=['POST'])
@token_required
def api_update_rider_order_status(order_id):
    try:
        from bson import ObjectId
        from user_model import User

        db, _ = get_mongodb_db(api_bp)
        if db is None:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        user = User.get_by_email(db, request.user_email)
        if not user or getattr(user, 'role', 'user') != 'rider':
            return jsonify({'success': False, 'message': 'Not authorized'}), 403

        data = request.get_json() or {}
        new_status = (data.get('status') or '').strip().lower()
        if new_status not in ('picked_up', 'on_the_way', 'delivered'):
            return jsonify({'success': False, 'message': 'Invalid status'}), 400

        order_doc = None
        if ObjectId.is_valid(order_id):
            order_doc = db.orders.find_one({'_id': ObjectId(order_id)})
        if not order_doc:
            return jsonify({'success': False, 'message': 'Order not found'}), 404

        rider_doc = db.riders.find_one({'user_id': str(user.id)})
        if not rider_doc:
            rider_doc = db.riders.find_one({'email': user.email})
        if not rider_doc:
            return jsonify({'success': False, 'message': 'Rider profile not found'}), 404

        assigned_id = str(rider_doc.get('_id'))
        if order_doc.get('assigned_rider_id') != assigned_id:
            return jsonify({'success': False, 'message': 'Not authorized'}), 403

        current_status = (order_doc.get('delivery_status') or order_doc.get('status') or 'pending').lower()
        if new_status == 'picked_up' and current_status not in ('ready_for_ship', 'picked_up'):
            return jsonify({'success': False, 'message': 'Order must be ready for ship'}), 400
        if new_status == 'on_the_way' and current_status not in ('picked_up', 'on_the_way'):
            return jsonify({'success': False, 'message': 'Order must be picked up'}), 400
        if new_status == 'delivered' and current_status not in ('on_the_way', 'delivered'):
            return jsonify({'success': False, 'message': 'Order must be on the way'}), 400

        update_fields = {
            'status': new_status,
            'delivery_status': new_status,
            'updated_at': datetime.utcnow(),
        }

        delivery_updates = list(order_doc.get('delivery_updates', []))
        delivery_updates.append({
            'status': new_status,
            'updated_at': datetime.utcnow(),
        })
        update_fields['delivery_updates'] = delivery_updates

        db.orders.update_one({'_id': order_doc['_id']}, {'$set': update_fields})

        try:
            buyer = db.users.find_one({'id': order_doc.get('user_id')})
            buyer_email = buyer.get('email') if buyer else None
            buyer_name = buyer.get('first_name') if buyer else 'Customer'
            if buyer_email:
                status_label = new_status.replace('_', ' ').upper()
                email_html = build_email_html(
                    title="Delivery Update",
                    subtitle="Your order delivery status changed",
                    badge_text=status_label,
                    content_html=(
                        f"<p>Hi {buyer_name},</p>"
                        f"<p>Your order status is now <strong>{status_label}</strong>.</p>"
                        f'<div style="background:#f3f4f6;padding:12px 14px;border-radius:10px;">'
                        f"<strong>Order ID:</strong> {order_id}</div>"
                        "<p style='margin-top:12px;'>Thank you for shopping with FarmtoClick.</p>"
                    ),
                )
                send_system_email(
                    current_app,
                    buyer_email,
                    "FarmtoClick Delivery Update",
                    f"Order {order_id} status updated to {status_label}.",
                    html_body=email_html,
                )
        except Exception as e:
            print(f"Rider status email error: {e}")

        return jsonify({'success': True, 'status': new_status})
    except Exception as e:
        return jsonify({'success': False, 'message': 'Failed to update order'}), 500


@api_bp.route('/orders/<order_id>/tracking', methods=['GET'])
@token_required
def api_order_tracking(order_id):
    try:
        from bson import ObjectId

        db, _ = get_mongodb_db(api_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500

        order_doc = None
        if ObjectId.is_valid(order_id):
            order_doc = db.orders.find_one({'_id': ObjectId(order_id)})
        if not order_doc:
            return jsonify({'error': 'Order not found'}), 404

        if order_doc.get('user_id') != request.user_id:
            return jsonify({'error': 'Not authorized'}), 403

        tracking_id = order_doc.get('delivery_tracking_id')
        delivery_status = order_doc.get('delivery_status', order_doc.get('status', 'pending'))

        if tracking_id:
            latest = get_delivery_status(tracking_id)
            if latest and latest.get('status') and latest.get('status') != delivery_status:
                delivery_status = latest.get('status')
                update_fields = {
                    'delivery_status': delivery_status,
                    'updated_at': datetime.utcnow(),
                }
                delivery_updates = list(order_doc.get('delivery_updates', []))
                delivery_updates.append({
                    'status': delivery_status,
                    'updated_at': datetime.utcnow(),
                })
                update_fields['delivery_updates'] = delivery_updates
                db.orders.update_one({'_id': order_doc['_id']}, {'$set': update_fields})

        return jsonify({
            'order_id': str(order_doc.get('_id')),
            'delivery_status': delivery_status,
            'delivery_tracking_id': tracking_id,
            'delivery_updates': order_doc.get('delivery_updates', []),
            'logistics_provider': order_doc.get('logistics_provider', 'lalamove'),
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/orders', methods=['POST'])
@token_required
def api_create_order():
    try:
        from bson import ObjectId

        data = request.get_json() or {}
        shipping_name = (data.get('shipping_name') or '').strip()
        shipping_phone = (data.get('shipping_phone') or '').strip()
        shipping_address = (data.get('shipping_address') or '').strip()
        payment_method_raw = (data.get('payment_method') or '').strip()
        payment_method = payment_method_raw.lower()

        if not all([shipping_name, shipping_phone, shipping_address, payment_method_raw]):
            return jsonify({'error': 'Please fill out all shipping details and payment method'}), 400

        db, _ = get_mongodb_db(api_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500

        cart_doc = db.carts.find_one({'user_id': request.user_id})
        if not cart_doc or not cart_doc.get('items'):
            return jsonify({'error': 'Your cart is empty'}), 400

        is_mobile_money = payment_method == 'mobile'
        order_items = []
        total_amount = 0.0

        for item in cart_doc.get('items', []):
            product_id = item.get('product_id')
            qty = int(item.get('quantity', 1))

            product_data = None
            if product_id and ObjectId.is_valid(product_id):
                product_data = db.products.find_one({'_id': ObjectId(product_id)})
            if not product_data:
                product_data = db.products.find_one({'id': product_id})
            if not product_data:
                continue

            price = float(product_data.get('price', 0) or 0)
            name = product_data.get('name', 'Product')
            unit = product_data.get('unit', '')

            order_items.append({
                'product_id': str(product_data.get('_id', product_id)),
                'name': name,
                'quantity': qty,
                'price': price,
                'unit': unit,
            })
            total_amount += price * qty

            if not is_mobile_money:
                try:
                    db.products.update_one({'_id': product_data.get('_id')}, {'$inc': {'quantity': -qty}})
                except Exception:
                    pass

        if not order_items:
            return jsonify({'error': 'Unable to place order. Please try again.'}), 400

        order_doc = {
            'user_id': request.user_id,
            'items': order_items,
            'total_amount': total_amount,
            'status': 'pending',
            'delivery_status': 'pending',
            'logistics_provider': 'lalamove',
            'delivery_tracking_id': None,
            'delivery_updates': [],
            'shipping_name': shipping_name,
            'shipping_phone': shipping_phone,
            'shipping_address': shipping_address,
            'payment_method': payment_method_raw,
            'payment_status': 'pending' if is_mobile_money else 'unpaid',
            'payment_provider': 'paymongo' if is_mobile_money else None,
            'payment_channel': 'gcash' if is_mobile_money else None,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
        }

        order_result = db.orders.insert_one(order_doc)
        order_id = str(order_result.inserted_id)
        order_doc['_id'] = order_id

        if not is_mobile_money:
            try:
                receipt_pdf = generate_receipt_pdf(order_id, shipping_name, request.user_email, order_items, total_amount)
                email_html = build_email_html(
                    title="Order Confirmed",
                    subtitle="Your order is pending seller approval",
                    badge_text="PENDING APPROVAL",
                    content_html=(
                        f"<p>Hi {shipping_name},</p>"
                        "<p>Your order has been confirmed and is pending seller approval.</p>"
                        f'<div style="background:#f3f4f6;padding:12px 14px;border-radius:10px;">'
                        f"<strong>Order ID:</strong> {order_id}</div>"
                        "<p style='margin-top:12px;'>We will email you again once the seller approves your order.</p>"
                        "<p>Thank you for shopping with FarmtoClick.</p>"
                    ),
                )
                send_system_email(
                    current_app,
                    request.user_email,
                    "FarmtoClick Order Confirmed - Pending Approval",
                    f"Order ID: {order_id}\nTotal: {total_amount}",
                    html_body=email_html,
                    attachments=[{
                        'filename': f"FarmtoClick-Receipt-{order_id}.pdf",
                        'content': receipt_pdf,
                        'maintype': 'application',
                        'subtype': 'pdf',
                    }],
                )
            except Exception as e:
                print(f"Order confirmation email error: {e}")

            db.carts.delete_one({'_id': cart_doc['_id']})

        if is_mobile_money:
            success_url, cancel_url = _get_paymongo_redirect_urls()
            if not success_url or not cancel_url:
                return jsonify({'error': 'PayMongo redirect URLs are not configured'}), 500

            try:
                line_items = [
                    {
                        'name': item.get('name', 'Item'),
                        'quantity': int(item.get('quantity', 1)),
                        'amount': int(round(float(item.get('price', 0) or 0) * 100)),
                        'currency': 'PHP',
                    }
                    for item in order_items
                ]
                checkout = create_checkout_session(
                    amount=int(round(total_amount * 100)),
                    description=f'FarmtoClick Order {order_id}',
                    success_url=success_url,
                    cancel_url=cancel_url,
                    payment_method_types=['gcash', 'qrph'],
                    line_items=line_items,
                    metadata={'order_id': order_id, 'user_id': request.user_id},
                    reference_number=str(order_id),
                )
                db.orders.update_one(
                    {'_id': order_result.inserted_id},
                    {'$set': {
                        'paymongo_checkout_id': checkout['id'],
                        'paymongo_checkout_url': checkout['checkout_url'],
                        'payment_status': 'pending',
                        'payment_provider': 'paymongo',
                        'updated_at': datetime.utcnow(),
                    }},
                )
                order_doc['paymongo_checkout_id'] = checkout['id']
                order_doc['paymongo_checkout_url'] = checkout['checkout_url']
                return jsonify({
                    'message': 'Checkout session created',
                    'checkout_url': checkout['checkout_url'],
                    'order': order_doc,
                }), 201
            except PayMongoError as exc:
                db.orders.update_one(
                    {'_id': order_result.inserted_id},
                    {'$set': {
                        'payment_status': 'failed',
                        'payment_error': str(exc),
                        'updated_at': datetime.utcnow(),
                    }},
                )
                print(f"PayMongo checkout error: {exc}")
                return jsonify({
                    'error': 'Unable to initialize mobile money payment. Please use cash payment instead.',
                    'details': str(exc),
                }), 400

        return jsonify({'message': 'Order placed successfully', 'order': order_doc}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/paymongo/webhook', methods=['POST'])
def api_paymongo_webhook():
    try:
        payload_raw = request.get_data() or b''
        signature_header = (
            request.headers.get('Paymongo-Signature')
            or request.headers.get('PayMongo-Signature')
            or request.headers.get('paymongo-signature')
            or ''
        )
        try:
            if not verify_webhook_signature(payload_raw, signature_header):
                return jsonify({'error': 'Invalid signature'}), 401
        except PayMongoError:
            return jsonify({'error': 'Webhook secret not configured'}), 401

        payload = request.get_json(silent=True) or {}
        event = payload.get('data', {}).get('attributes', {})
        event_type = (event.get('type') or '').lower()

        data_payload = event.get('data', {})
        data_attrs = data_payload.get('attributes', {})

        metadata = {}
        if isinstance(data_attrs.get('metadata'), dict):
            metadata = data_attrs.get('metadata')
        elif isinstance(data_attrs.get('source', {}), dict):
            metadata = data_attrs.get('source', {}).get('metadata', {}) or {}

        order_id = metadata.get('order_id') or metadata.get('orderId')
        if not order_id:
            return jsonify({'received': True}), 200

        db, _ = get_mongodb_db(api_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500

        from bson import ObjectId
        order_filter = {'_id': ObjectId(order_id)} if ObjectId.is_valid(str(order_id)) else {'_id': order_id}
        order_doc = db.orders.find_one(order_filter)
        if not order_doc:
            return jsonify({'received': True}), 200

        update_fields = {'updated_at': datetime.utcnow()}
        if event_type in ('payment.paid', 'checkout_session.payment.paid'):
            if order_doc.get('payment_status') == 'paid':
                return jsonify({'received': True}), 200
            update_fields['payment_status'] = 'paid'
            update_fields['paymongo_payment_id'] = data_payload.get('id')
            update_fields['paid_at'] = datetime.utcnow()
            db.orders.update_one(order_filter, {'$set': update_fields})
            _finalize_paid_order(db, order_doc)
        elif event_type in ('payment.failed', 'payment.expired', 'checkout_session.payment.failed'):
            update_fields['payment_status'] = 'failed'
            update_fields['payment_failed_at'] = datetime.utcnow()
            db.orders.update_one(order_filter, {'$set': update_fields})

        return jsonify({'received': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/farmer/orders', methods=['GET'])
@token_required
def api_farmer_orders():
    try:
        from bson import ObjectId
        from user_model import User

        db, _ = get_mongodb_db(api_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500

        user = User.get_by_email(db, request.user_email)
        if not user or getattr(user, 'role', 'user') != 'farmer':
            return jsonify({'error': 'Not authorized'}), 403

        farmer_id = str(user.id)
        seller_orders = []
        product_cache = {}

        def _get_product(pid):
            if pid in product_cache:
                return product_cache[pid]
            doc = None
            try:
                if ObjectId.is_valid(str(pid)):
                    doc = db.products.find_one({'_id': ObjectId(str(pid))})
            except Exception:
                pass
            if not doc:
                doc = db.products.find_one({'id': str(pid)})
            product_cache[pid] = doc
            return doc

        for order_doc in db.orders.find().sort('created_at', -1):
            order_items = []
            for item in order_doc.get('items', []):
                pdoc = _get_product(item.get('product_id'))
                if not pdoc:
                    continue
                if pdoc.get('farmer') != farmer_id and pdoc.get('farmer_user_id') != farmer_id:
                    continue
                order_items.append({
                    'name': item.get('name', pdoc.get('name', 'Product')),
                    'quantity': item.get('quantity', 1),
                    'price': item.get('price', pdoc.get('price', 0)),
                })

            if order_items:
                buyer = db.users.find_one({'id': order_doc.get('user_id')})
                seller_orders.append({
                    'id': str(order_doc.get('_id')),
                    'status': order_doc.get('status', 'pending'),
                    'delivery_status': order_doc.get('delivery_status', ''),
                    'delivery_tracking_id': order_doc.get('delivery_tracking_id'),
                    'created_at': order_doc.get('created_at'),
                    'payment_method': order_doc.get('payment_method'),
                    'payment_provider': order_doc.get('payment_provider'),
                    'payment_status': order_doc.get('payment_status'),
                    'buyer_name': (buyer.get('first_name') if buyer else 'Customer'),
                    'buyer_email': (buyer.get('email') if buyer else ''),
                    'shipping_name': order_doc.get('shipping_name'),
                    'shipping_phone': order_doc.get('shipping_phone'),
                    'shipping_address': order_doc.get('shipping_address'),
                    'delivery_address': order_doc.get('delivery_address'),
                    'delivery_notes': order_doc.get('delivery_notes'),
                    'assigned_rider_id': order_doc.get('assigned_rider_id'),
                    'assigned_rider_name': order_doc.get('assigned_rider_name'),
                    'assigned_rider_phone': order_doc.get('assigned_rider_phone'),
                    'assigned_rider_barangay': order_doc.get('assigned_rider_barangay'),
                    'assigned_rider_city': order_doc.get('assigned_rider_city'),
                    'assigned_rider_province': order_doc.get('assigned_rider_province'),
                    'items': order_items,
                    'total_amount': order_doc.get('total_amount', 0),
                })

        return jsonify({'orders': seller_orders})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/order/<order_id>/status', methods=['POST'])
@token_required
def api_update_order_status(order_id):
    try:
        from bson import ObjectId
        from user_model import User

        db, _ = get_mongodb_db(api_bp)
        if db is None:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        user = User.get_by_email(db, request.user_email)
        if not user or getattr(user, 'role', 'user') != 'farmer':
            return jsonify({'success': False, 'message': 'Not authorized'}), 403

        if request.content_type and 'multipart/form-data' in request.content_type:
            data = request.form
        else:
            data = request.get_json() or {}

        new_status = (data.get('status') or '').strip().lower()
        status_reason = (data.get('reason') or '').strip()
        if new_status not in ('approved', 'rejected', 'confirmed', 'ready_for_ship', 'picked_up', 'on_the_way', 'delivered'):
            return jsonify({'success': False, 'message': 'Invalid status'}), 400
        if new_status == 'rejected' and not status_reason:
            return jsonify({'success': False, 'message': 'Rejection reason is required'}), 400

        order_doc = None
        if ObjectId.is_valid(order_id):
            order_doc = db.orders.find_one({'_id': ObjectId(order_id)})
        if not order_doc:
            return jsonify({'success': False, 'message': 'Order not found'}), 404

        if new_status == 'ready_for_ship' and order_doc.get('status') != 'approved':
            return jsonify({'success': False, 'message': 'Order must be approved before ready for ship'}), 400

        if order_doc.get('payment_provider') == 'paymongo' and order_doc.get('payment_status') != 'paid':
            return jsonify({'success': False, 'message': 'Payment not confirmed'}), 400

        farmer_id = str(user.id)

        def _belongs_to_farmer(item):
            pid = item.get('product_id')
            if not pid:
                return False
            pdoc = None
            if ObjectId.is_valid(str(pid)):
                pdoc = db.products.find_one({'_id': ObjectId(str(pid))})
            if not pdoc:
                pdoc = db.products.find_one({'id': str(pid)})
            if not pdoc:
                return False
            return pdoc.get('farmer') == farmer_id or pdoc.get('farmer_user_id') == farmer_id

        if not any(_belongs_to_farmer(item) for item in order_doc.get('items', [])):
            return jsonify({'success': False, 'message': 'Not authorized'}), 403

        update_fields = {'status': new_status, 'updated_at': datetime.utcnow()}
        if new_status == 'rejected':
            update_fields['rejection_reason'] = status_reason

        if new_status == 'ready_for_ship' and not order_doc.get('delivery_tracking_id'):
            delivery = create_delivery_order(order_id, None, order_doc.get('shipping_address', ''))
            update_fields['delivery_tracking_id'] = delivery.get('tracking_id')
            update_fields['delivery_status'] = delivery.get('status', 'ready_for_ship')
        elif new_status in ('approved', 'picked_up', 'on_the_way', 'delivered'):
            update_fields['delivery_status'] = new_status
        elif new_status == 'rejected':
            update_fields['delivery_status'] = 'cancelled'

        delivery_updates = list(order_doc.get('delivery_updates', []))
        delivery_updates.append({
            'status': update_fields.get('delivery_status', new_status),
            'updated_at': datetime.utcnow(),
        })
        update_fields['delivery_updates'] = delivery_updates

        db.orders.update_one({'_id': order_doc['_id']}, {'$set': update_fields})

        # Send status update email
        try:
            buyer = db.users.find_one({'id': order_doc.get('user_id')})
            buyer_email = buyer.get('email') if buyer else None
            buyer_name = buyer.get('first_name') if buyer else 'Customer'

            if buyer_email:
                reason_html = ""
                if new_status == 'rejected' and status_reason:
                    reason_html = f"<p><strong>Reason:</strong> {status_reason}</p>"
                status_html = build_email_html(
                    title="Order Status Update",
                    subtitle="Your order status has been updated",
                    badge_text=new_status.upper(),
                    content_html=(
                        f"<p>Hi {buyer_name},</p>"
                        f"<p>Your order status is now <strong>{new_status.upper()}</strong>.</p>"
                        f'<div style="background:#f3f4f6;padding:12px 14px;border-radius:10px;">'
                        f"<strong>Order ID:</strong> {order_id}</div>"
                        f"{reason_html}"
                        "<p style='margin-top:12px;'>Thank you for shopping with FarmtoClick.</p>"
                    ),
                )
                send_system_email(
                    current_app,
                    buyer_email,
                    "FarmtoClick Order Status Update",
                    f"Order {order_id} is now {new_status.upper()}.",
                    html_body=status_html,
                )
        except Exception as e:
            print(f"Order status email error: {e}")

        return jsonify({'success': True, 'status': new_status})
    except Exception as e:
        return jsonify({'success': False, 'message': 'Failed to update order'}), 500


@api_bp.route('/riders', methods=['GET'])
@token_required
def api_get_active_riders():
    try:
        from user_model import User

        db, _ = get_mongodb_db(api_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500

        user = User.get_by_email(db, request.user_email)
        if not user or getattr(user, 'role', 'user') not in ('farmer', 'admin'):
            return jsonify({'error': 'Not authorized'}), 403

        riders = list(db.riders.find({'active': True}).sort('created_at', -1))
        rider_list = []
        for rider in riders:
            rider_list.append({
                'id': str(rider.get('_id')),
                'name': rider.get('name', ''),
                'phone': rider.get('phone', ''),
                'barangay': rider.get('barangay', ''),
                'city': rider.get('city', ''),
                'province': rider.get('province', ''),
                'active': bool(rider.get('active', True)),
            })

        return jsonify({'riders': rider_list})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/orders/<order_id>/assign-rider', methods=['POST'])
@token_required
def api_assign_order_rider(order_id):
    try:
        from bson import ObjectId
        from user_model import User

        db, _ = get_mongodb_db(api_bp)
        if db is None:
            return jsonify({'success': False, 'message': 'Database connection failed'}), 500

        user = User.get_by_email(db, request.user_email)
        if not user or getattr(user, 'role', 'user') != 'farmer':
            return jsonify({'success': False, 'message': 'Not authorized'}), 403

        data = request.get_json() or {}
        rider_id = (data.get('rider_id') or '').strip()
        if not rider_id:
            return jsonify({'success': False, 'message': 'Rider is required'}), 400

        rider_doc = None
        if ObjectId.is_valid(rider_id):
            rider_doc = db.riders.find_one({'_id': ObjectId(rider_id)})
        if not rider_doc:
            return jsonify({'success': False, 'message': 'Rider not found'}), 404
        if not rider_doc.get('active', True):
            return jsonify({'success': False, 'message': 'Rider is inactive'}), 400

        order_doc = None
        if ObjectId.is_valid(order_id):
            order_doc = db.orders.find_one({'_id': ObjectId(order_id)})
        if not order_doc:
            return jsonify({'success': False, 'message': 'Order not found'}), 404

        farmer_id = str(user.id)

        def _belongs_to_farmer(item):
            pid = item.get('product_id')
            if not pid:
                return False
            pdoc = None
            if ObjectId.is_valid(str(pid)):
                pdoc = db.products.find_one({'_id': ObjectId(str(pid))})
            if not pdoc:
                pdoc = db.products.find_one({'id': str(pid)})
            if not pdoc:
                return False
            return pdoc.get('farmer') == farmer_id or pdoc.get('farmer_user_id') == farmer_id

        if not any(_belongs_to_farmer(item) for item in order_doc.get('items', [])):
            return jsonify({'success': False, 'message': 'Not authorized'}), 403

        update_doc = {
            'assigned_rider_id': str(rider_doc.get('_id')),
            'assigned_rider_name': rider_doc.get('name', ''),
            'assigned_rider_phone': rider_doc.get('phone', ''),
            'assigned_rider_barangay': rider_doc.get('barangay', ''),
            'assigned_rider_city': rider_doc.get('city', ''),
            'assigned_rider_province': rider_doc.get('province', ''),
            'assigned_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
        }

        db.orders.update_one({'_id': order_doc['_id']}, {'$set': update_doc})

        try:
            buyer = db.users.find_one({'id': order_doc.get('user_id')})
            buyer_email = buyer.get('email') if buyer else None
            buyer_name = buyer.get('first_name') if buyer else 'Customer'
            if buyer_email:
                rider_area = ', '.join([
                    rider_doc.get('barangay', ''),
                    rider_doc.get('city', ''),
                    rider_doc.get('province', ''),
                ]).strip(', ')
                email_html = build_email_html(
                    title="Rider Assigned",
                    subtitle="Your order is now scheduled for delivery",
                    badge_text="RIDER ASSIGNED",
                    content_html=(
                        f"<p>Hi {buyer_name},</p>"
                        "<p>Your order now has a rider assigned and will be delivered soon.</p>"
                        f"<div style=\"background:#f3f4f6;padding:12px 14px;border-radius:10px;\">"
                        f"<strong>Order ID:</strong> {order_id}<br/>"
                        f"<strong>Rider:</strong> {rider_doc.get('name', 'Rider')}<br/>"
                        f"<strong>Phone:</strong> {rider_doc.get('phone', 'N/A')}<br/>"
                        f"<strong>Area:</strong> {rider_area or 'N/A'}"
                        "</div>"
                        "<p style='margin-top:12px;'>Thank you for shopping with FarmtoClick.</p>"
                    ),
                )
                send_system_email(
                    current_app,
                    buyer_email,
                    "FarmtoClick Order Rider Assigned",
                    f"Your order {order_id} has an assigned rider.",
                    html_body=email_html,
                )
        except Exception as e:
            print(f"Rider assignment email error: {e}")

        return jsonify({'success': True, 'rider': update_doc})
    except Exception as e:
        return jsonify({'success': False, 'message': 'Failed to assign rider'}), 500


# ------------------------------------------------------------------
# Farmer products
# ------------------------------------------------------------------
@api_bp.route('/farmer/products', methods=['GET'])
@token_required
def api_farmer_products():
    try:
        from user_model import User

        db, _ = get_mongodb_db(api_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500

        user = User.get_by_email(db, request.user_email)
        if not user or getattr(user, 'role', 'user') != 'farmer':
            return jsonify({'error': 'Not authorized'}), 403

        farmer_id = str(user.id)
        farmer_email = user.email
        or_filters = [
            {'farmer': farmer_id},
            {'farmer_user_id': farmer_id},
            {'farmer_email': farmer_email},
            {'farmer_id': farmer_id},
            {'farmerId': farmer_id},
            {'seller_id': farmer_id},
            {'sellerId': farmer_id},
        ]

        products = list(db.products.find({'$or': or_filters}).sort('created_at', -1))
        for prod in products:
            prod['_id'] = str(prod.get('_id'))
            prod['id'] = prod.get('id') or prod['_id']

        return jsonify({'products': products})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/farmer/products', methods=['POST'])
@token_required
def api_farmer_add_product():
    try:
        from user_model import User

        db, _ = get_mongodb_db(api_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500

        user = User.get_by_email(db, request.user_email)
        if not user or getattr(user, 'role', 'user') != 'farmer':
            return jsonify({'error': 'Not authorized'}), 403

        name = request.form.get('name', '').strip()
        description = request.form.get('description', '').strip()
        category = request.form.get('category', '').strip()
        unit = request.form.get('unit', '').strip()
        price_raw = request.form.get('price', '').strip()
        quantity_raw = request.form.get('quantity', '').strip()
        available = request.form.get('available') in ('on', 'true', '1', 'yes')
        # audience may be submitted multiple times (checkboxes). default to ['customers']
        audience_list = request.form.getlist('audience') or ['customers']

        if not name or not description or not category or not unit:
            return jsonify({'error': 'Name, description, category, and unit are required'}), 400

        try:
            price = float(price_raw)
        except Exception:
            return jsonify({'error': 'Price must be a number'}), 400
        try:
            quantity = int(quantity_raw)
        except Exception:
            return jsonify({'error': 'Quantity must be a whole number'}), 400

        if price <= 0:
            return jsonify({'error': 'Price must be greater than 0'}), 400
        if quantity < 0:
            return jsonify({'error': 'Quantity cannot be negative'}), 400

        image_url = None
        image_file = request.files.get('image')
        if image_file and image_file.filename:
            if not allowed_file(image_file.filename):
                return jsonify({'error': 'Invalid product image type'}), 400
            image_file.seek(0, os.SEEK_END)
            fsize = image_file.tell()
            image_file.seek(0)
            if fsize > MAX_FILE_SIZE:
                return jsonify({'error': 'Product image is too large (max 5 MB)'}), 400

            original = secure_filename(image_file.filename)
            unique_name = f"{uuid.uuid4().hex}_{original}"
            product_folder = os.path.join(_BACKEND_DIR, 'static', 'uploads', 'products')
            os.makedirs(product_folder, exist_ok=True)
            image_file.save(os.path.join(product_folder, unique_name))
            image_url = url_for('static', filename=f"uploads/products/{unique_name}")

        product_doc = {
            'name': name,
            'description': description,
            'price': price,
            'quantity': quantity,
            'unit': unit,
            'category': category,
            'available': available,
            'audience': audience_list,
            'image_url': image_url,
            'farmer': str(user.id),
            'farmer_user_id': str(user.id),
            'farmer_email': user.email,
            'created_at': datetime.utcnow(),
        }

        result = db.products.insert_one(product_doc)
        product_doc['_id'] = str(result.inserted_id)
        product_doc['id'] = product_doc.get('id') or product_doc['_id']

        return jsonify({'message': 'Product added successfully', 'product': product_doc}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/farmer/products/<product_id>', methods=['PUT'])
@token_required
def api_farmer_update_product(product_id):
    try:
        from bson import ObjectId
        from user_model import User

        db, _ = get_mongodb_db(api_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500

        user = User.get_by_email(db, request.user_email)
        if not user or getattr(user, 'role', 'user') != 'farmer':
            return jsonify({'error': 'Not authorized'}), 403

        query = {'$or': [
            {'_id': ObjectId(product_id)} if ObjectId.is_valid(product_id) else {'id': product_id},
            {'id': product_id},
        ]}

        product_doc = db.products.find_one(query)
        if not product_doc:
            return jsonify({'error': 'Product not found'}), 404

        farmer_id = str(user.id)
        if not (
            product_doc.get('farmer') == farmer_id
            or product_doc.get('farmer_user_id') == farmer_id
            or product_doc.get('farmer_email') == user.email
        ):
            return jsonify({'error': 'Not authorized'}), 403

        update_doc = {}
        for field in ('name', 'description', 'category', 'unit'):
            if field in request.form:
                update_doc[field] = request.form.get(field, '').strip()

        if 'price' in request.form:
            try:
                update_doc['price'] = float(request.form.get('price', '').strip())
            except Exception:
                return jsonify({'error': 'Price must be a number'}), 400
        if 'quantity' in request.form:
            try:
                update_doc['quantity'] = int(request.form.get('quantity', '').strip())
            except Exception:
                return jsonify({'error': 'Quantity must be a whole number'}), 400

        if 'available' in request.form:
            update_doc['available'] = request.form.get('available') in ('on', 'true', '1', 'yes')
        # Update audience if provided (may be multiple values)
        if 'audience' in request.form:
            audience_list = request.form.getlist('audience') or []
            update_doc['audience'] = audience_list

        image_file = request.files.get('image')
        if image_file and image_file.filename:
            if not allowed_file(image_file.filename):
                return jsonify({'error': 'Invalid product image type'}), 400
            image_file.seek(0, os.SEEK_END)
            fsize = image_file.tell()
            image_file.seek(0)
            if fsize > MAX_FILE_SIZE:
                return jsonify({'error': 'Product image is too large (max 5 MB)'}), 400

            original = secure_filename(image_file.filename)
            unique_name = f"{uuid.uuid4().hex}_{original}"
            product_folder = os.path.join(_BACKEND_DIR, 'static', 'uploads', 'products')
            os.makedirs(product_folder, exist_ok=True)
            image_file.save(os.path.join(product_folder, unique_name))
            update_doc['image_url'] = url_for('static', filename=f"uploads/products/{unique_name}")

        if not update_doc:
            return jsonify({'error': 'No valid fields to update'}), 400

        db.products.update_one({'_id': product_doc['_id']}, {'$set': update_doc})

        return jsonify({'message': 'Product updated successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/farmer/products/<product_id>', methods=['DELETE'])
@token_required
def api_farmer_delete_product(product_id):
    try:
        from bson import ObjectId
        from user_model import User

        db, _ = get_mongodb_db(api_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500

        user = User.get_by_email(db, request.user_email)
        if not user or getattr(user, 'role', 'user') != 'farmer':
            return jsonify({'error': 'Not authorized'}), 403

        query = {'_id': ObjectId(product_id)} if ObjectId.is_valid(product_id) else {'id': product_id}
        product_doc = db.products.find_one(query)
        if not product_doc:
            return jsonify({'error': 'Product not found'}), 404

        farmer_id = str(user.id)
        if not (
            product_doc.get('farmer') == farmer_id
            or product_doc.get('farmer_user_id') == farmer_id
            or product_doc.get('farmer_email') == user.email
        ):
            return jsonify({'error': 'Not authorized'}), 403

        db.products.delete_one({'_id': product_doc['_id']})
        return jsonify({'message': 'Product deleted successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ------------------------------------------------------------------
# Farmers listing
# ------------------------------------------------------------------
@api_bp.route('/farmers', methods=['GET'])
def api_farmers():
    try:
        db, _ = get_mongodb_db(api_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500

        farmers = list(db.users.find({'role': 'farmer'}))
        return jsonify([{
            'id': f.get('id') or str(f['_id']),
            '_id': str(f['_id']),
            'first_name': f.get('first_name', ''),
            'last_name': f.get('last_name', ''),
            'email': f.get('email', ''),
            'farm_name': f.get('farm_name', ''),
            'farm_description': f.get('farm_description', ''),
            'farm_location': f.get('farm_location', ''),
            'farm_phone': f.get('farm_phone', ''),
            'exact_address': f.get('exact_address', ''),
            'overall_location': f.get('overall_location', ''),
            'profile_picture': f.get('profile_picture', ''),
            'phone': f.get('phone', ''),
            'product_count': f.get('product_count', 0),
        } for f in farmers])
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/farmer/<farmer_id>', methods=['GET'])
def api_farmer_profile(farmer_id):
    """Public farmer profile with their products."""
    try:
        from bson import ObjectId

        db, _ = get_mongodb_db(api_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500

        # Try by UUID 'id' field first, then by Mongo _id
        farmer = db.users.find_one({'id': farmer_id, 'role': 'farmer'})
        if not farmer and ObjectId.is_valid(farmer_id):
            farmer = db.users.find_one({'_id': ObjectId(farmer_id), 'role': 'farmer'})
        if not farmer:
            return jsonify({'error': 'Farmer not found'}), 404

        farmer['_id'] = str(farmer['_id'])
        farmer_uuid = farmer.get('id') or farmer['_id']

        # Look up products belonging to this farmer
        product_filters = [
            {'farmer': farmer_uuid},
            {'farmer_user_id': farmer_uuid},
            {'farmer_email': farmer.get('email')},
        ]
        if ObjectId.is_valid(farmer['_id']):
            product_filters.append({'farmer': ObjectId(farmer['_id'])})

        products = list(
            db.products.find({'$or': product_filters, 'available': True}).sort('created_at', -1)
        )
        for p in products:
            p['_id'] = str(p['_id'])
            p['id'] = p.get('id') or p['_id']

        return jsonify({'farmer': farmer, 'products': products})
    except Exception as e:
        print(f"Farmer profile API error: {e}")
        return jsonify({'error': 'Farmer not found'}), 404


# ------------------------------------------------------------------
# Debug endpoint to verify current user's role
# ------------------------------------------------------------------
@api_bp.route('/auth/me', methods=['GET'])
def api_current_user():
    """Returns the current authenticated user's full data including role"""
    try:
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify({'error': 'No token provided'}), 401

        from user_model import User
        db, _ = get_mongodb_db(api_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500

        try:
            payload = jwt.decode(token, current_app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401

        user = User.get_by_id(db, payload['user_id'])
        if not user:
            return jsonify({'error': 'User not found'}), 404

        return jsonify({
            'user': {
                'id': str(user.id),
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'role': user.role,
                'is_admin': user.role == 'admin',
                'is_farmer': user.role == 'farmer',
                'profile_picture': user.profile_picture,
                'phone': getattr(user, 'phone', ''),
                'overall_location': getattr(user, 'overall_location', ''),
                'shipping_address': getattr(user, 'shipping_address', ''),
            },
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ===========================================================================
# DTI SRP Price Suggestion System
# ===========================================================================

@api_bp.route('/dti/suggest-price', methods=['GET'])
@token_required
def api_dti_suggest_price():
    """
    Suggest a retail price for a product based on DTI records.
    Query params: name (required), unit (optional), category (optional)
    """
    try:
        from dti_price_engine import suggest_price

        db, _ = get_mongodb_db(api_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500

        product_name = request.args.get('name', '').strip()
        unit = request.args.get('unit', 'kg').strip()
        category = request.args.get('category', '').strip()
        audience = request.args.get('audience', '').strip().lower()  # optional: 'co-vendors' or 'customers'

        if not product_name:
            return jsonify({'error': 'Product name is required'}), 400

        # If audience is co-vendors, use 15% markup override
        if audience == 'co-vendors':
            result = suggest_price(db, product_name, unit=unit, category=category, markup_override=0.15)
        else:
            result = suggest_price(db, product_name, unit=unit, category=category)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ------------------------------------------------------------------
# Co-vendors marketplace (farmer-only)
# ------------------------------------------------------------------
@api_bp.route('/products/covendors', methods=['GET'])
@token_required
def api_products_covendors():
    try:
        from user_model import User

        db, _ = get_mongodb_db(api_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500

        user = User.get_by_email(db, request.user_email)
        if not user or getattr(user, 'role', 'user') != 'farmer':
            return jsonify({'error': 'Not authorized'}), 403

        # Find products that have been marked visible to co-vendors
        from bson import ObjectId
        products = list(db.products.find({'audience': 'co-vendors', 'available': True}).sort('created_at', -1))
        out = []
        for p in products:
            p['_id'] = str(p.get('_id'))
            p['id'] = p.get('id') or p['_id']
            farmer_name = p.get('farmer_name', '')
            farmer_info = None
            if not farmer_name:
                possible_ids = [p.get(k) for k in ('farmer', 'farmer_user_id', 'farmer_id', 'farmerId', 'seller_id', 'sellerId') if p.get(k)]
                found = None
                for fid in possible_ids:
                    try:
                        if ObjectId.is_valid(str(fid)):
                            found = db.users.find_one({'_id': ObjectId(str(fid))})
                        else:
                            found = db.users.find_one({'id': str(fid)}) or db.users.find_one({'email': str(fid)})
                    except Exception:
                        found = db.users.find_one({'id': str(fid)})
                    if found:
                        break
                if found:
                    farmer_name = f"{found.get('first_name','').strip()} {found.get('last_name','').strip()}".strip() or found.get('farm_name') or found.get('name') or ''
                    farmer_info = {
                        'id': str(found.get('_id') or found.get('id') or ''),
                        'farm_name': found.get('farm_name', ''),
                        'name': farmer_name,
                        'location': found.get('farm_location') or found.get('overall_location') or found.get('location') or ''
                    }
            # Determine display price for co-vendors: prefer DTI-suggested price with 15% markup
            stored_price = p.get('price', 0)
            display_price = stored_price
            try:
                from dti_price_engine import suggest_price
                dti_res = suggest_price(db, p.get('name', ''), unit=p.get('unit', 'kg'), category=p.get('category', ''), markup_override=0.15)
                if isinstance(dti_res, dict) and dti_res.get('found') and dti_res.get('auto_price'):
                    display_price = dti_res.get('auto_price')
            except Exception:
                # If DTI suggestion fails, keep stored price
                display_price = stored_price

            out.append({
                    **{k: (p.get(k) or '') for k in ('id','name','description','image','image_url','category','location')},
                    'price': display_price,
                    'farmer_name': farmer_name or '',
                    'farmer': farmer_info,
                    'quantity': p.get('quantity', 0),
                    'unit': p.get('unit', ''),
                })
        return jsonify({'products': out})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/dti/product-suggestions', methods=['GET'])
@token_required
def api_dti_product_suggestions():
    """
    Get product name suggestions from DTI records based on partial name matching.
    Query params: name (required), limit (optional, default=10)
    
    Returns list of suggested product names with varieties in parentheses.
    Example: ["Banana (Cavendish)", "Banana (Latundan)", "Banana (Saba)"]
    """
    try:
        from dti_price_engine import suggest_product_names

        db, _ = get_mongodb_db(api_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500

        partial_name = request.args.get('name', '').strip()
        limit = request.args.get('limit', 10, type=int)

        if not partial_name or len(partial_name) < 1:
            return jsonify({'suggestions': []})

        suggestions = suggest_product_names(db, partial_name, limit=limit)
        return jsonify({'suggestions': suggestions})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/dti/prices', methods=['GET'])
@token_required
def api_dti_get_prices():
    """Get all active DTI price records."""
    try:
        from dti_price_engine import get_all_dti_records

        db, _ = get_mongodb_db(api_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500

        records = get_all_dti_records(db, active_only=True)
        return jsonify({'records': records, 'count': len(records)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/dti/upload-pdf', methods=['POST'])
@token_required
def api_dti_upload_pdf():
    """
    Upload a DTI price monitoring PDF. Admin only.
    Parses the PDF and stores extracted price records.
    """
    try:
        from user_model import User
        from dti_price_engine import parse_dti_pdf, save_dti_records

        db, _ = get_mongodb_db(api_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500

        user = User.get_by_email(db, request.user_email)
        if not user or getattr(user, 'role', 'user') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        pdf_file = request.files.get('pdf')
        if not pdf_file or not pdf_file.filename:
            return jsonify({'error': 'No PDF file provided'}), 400

        if not pdf_file.filename.lower().endswith('.pdf'):
            return jsonify({'error': 'File must be a PDF'}), 400

        # Save PDF temporarily
        upload_dir = os.path.join(_BACKEND_DIR, 'static', 'uploads', 'dti_pdfs')
        os.makedirs(upload_dir, exist_ok=True)
        unique_name = f"{uuid.uuid4().hex}_{secure_filename(pdf_file.filename)}"
        filepath = os.path.join(upload_dir, unique_name)
        pdf_file.save(filepath)

        # Parse PDF
        records, raw_text = parse_dti_pdf(filepath)

        if not records:
            return jsonify({
                'error': 'No price records could be extracted from the PDF. '
                         'You can add prices manually instead.',
                'raw_text_preview': raw_text[:2000] if raw_text else '',
            }), 400

        # Save to DB
        count = save_dti_records(db, records, pdf_file.filename, uploaded_by=request.user_email)

        return jsonify({
            'message': f'Successfully extracted and saved {count} price records',
            'count': count,
            'records': records,
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/dti/manual-entry', methods=['POST'])
@token_required
def api_dti_manual_entry():
    """
    Manually add a DTI price record. Admin only.
    Body: { product_name, price_low, price_high, unit }
    """
    try:
        from user_model import User
        from dti_price_engine import save_manual_dti_price

        db, _ = get_mongodb_db(api_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500

        user = User.get_by_email(db, request.user_email)
        if not user or getattr(user, 'role', 'user') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        data = request.get_json() or {}
        product_name = data.get('product_name', '').strip()
        price_low = data.get('price_low')
        price_high = data.get('price_high')
        unit = data.get('unit', 'kg').strip()

        if not product_name:
            return jsonify({'error': 'Product name is required'}), 400
        try:
            price_low = float(price_low)
            price_high = float(price_high) if price_high else price_low
        except (TypeError, ValueError):
            return jsonify({'error': 'Valid prices are required'}), 400

        if price_low <= 0:
            return jsonify({'error': 'Price must be greater than 0'}), 400

        doc = save_manual_dti_price(db, product_name, price_low, price_high, unit,
                                    uploaded_by=request.user_email)
        doc['_id'] = str(doc.get('_id', ''))

        return jsonify({'message': 'Price record added', 'record': doc}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/dti/bulk-entry', methods=['POST'])
@token_required
def api_dti_bulk_entry():
    """
    Add multiple DTI price records at once. Admin only.
    Body: { records: [{ product_name, price_low, price_high, unit }, ...] }
    """
    try:
        from user_model import User
        from dti_price_engine import save_dti_records

        db, _ = get_mongodb_db(api_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500

        user = User.get_by_email(db, request.user_email)
        if not user or getattr(user, 'role', 'user') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        data = request.get_json() or {}
        records = data.get('records', [])

        if not records:
            return jsonify({'error': 'No records provided'}), 400

        parsed = []
        for rec in records:
            name = rec.get('product_name', '').strip()
            try:
                low = float(rec.get('price_low', 0))
                high = float(rec.get('price_high', 0)) or low
            except (TypeError, ValueError):
                continue
            if name and low > 0:
                parsed.append({
                    'product_name': name,
                    'price_low': low,
                    'price_high': high,
                    'average_price': round((low + high) / 2, 2),
                    'unit': rec.get('unit', 'kg'),
                })

        if not parsed:
            return jsonify({'error': 'No valid records found'}), 400

        count = save_dti_records(db, parsed, 'bulk_manual_entry', uploaded_by=request.user_email)
        return jsonify({'message': f'Added {count} price records', 'count': count}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/dti/records/bulk-delete', methods=['POST'])
@token_required
def api_dti_bulk_delete():
    """Bulk delete (deactivate) multiple DTI price records. Admin only."""
    try:
        from user_model import User
        from dti_price_engine import delete_dti_records_bulk, delete_all_active_dti_records

        db, _ = get_mongodb_db(api_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500

        user = User.get_by_email(db, request.user_email)
        if not user or getattr(user, 'role', 'user') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        delete_all = data.get('delete_all', False)
        record_ids = data.get('record_ids', [])

        if delete_all:
            count = delete_all_active_dti_records(db)
        elif record_ids:
            count = delete_dti_records_bulk(db, record_ids)
        else:
            return jsonify({'error': 'Provide record_ids or set delete_all to true'}), 400

        return jsonify({'message': f'Deleted {count} record(s)', 'count': count})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/dti/records/<record_id>', methods=['DELETE'])
@token_required
def api_dti_delete_record(record_id):
    """Delete (deactivate) a single DTI price record. Admin only."""
    try:
        from user_model import User
        from dti_price_engine import delete_dti_record

        db, _ = get_mongodb_db(api_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500

        user = User.get_by_email(db, request.user_email)
        if not user or getattr(user, 'role', 'user') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        count = delete_dti_record(db, record_id)
        return jsonify({'message': f'Deleted {count} record(s)'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/dti/batch/<batch_id>', methods=['DELETE'])
@token_required
def api_dti_delete_batch(batch_id):
    """Delete (deactivate) all records in a batch. Admin only."""
    try:
        from user_model import User
        from dti_price_engine import delete_dti_batch

        db, _ = get_mongodb_db(api_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500

        user = User.get_by_email(db, request.user_email)
        if not user or getattr(user, 'role', 'user') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        count = delete_dti_batch(db, batch_id)
        return jsonify({'message': f'Deleted {count} records from batch'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
