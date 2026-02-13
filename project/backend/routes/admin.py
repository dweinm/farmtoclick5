"""
Admin routes: permit dashboard, debug endpoints, geocode proxy.
"""
from datetime import datetime, timedelta
from collections import defaultdict

from flask import Blueprint, render_template, request, redirect, flash, jsonify
from flask_login import login_required, current_user

from db import get_mongodb_db, ensure_mongoengine_user
from middleware import token_required

admin_bp = Blueprint('admin', __name__)


# ------------------------------------------------------------------
# Test endpoint (no auth required)
# ------------------------------------------------------------------
@admin_bp.route('/api/admin/test', methods=['GET'])
def admin_test():
    """Test endpoint to verify API is reachable"""
    return jsonify({'status': 'ok', 'message': 'Admin API is reachable'}), 200


# ------------------------------------------------------------------
# Admin products endpoint (all products, not just available)
# ------------------------------------------------------------------
@admin_bp.route('/api/admin/products', methods=['GET'])
@token_required
def get_all_products():
    """API endpoint to get all products (admin only)"""
    try:
        db, _ = get_mongodb_db(admin_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500
        
        # Check if current user is admin
        user_email = request.user_email
        if not user_email:
            return jsonify({'error': 'User email not found in token'}), 401
        
        admin_user = db.users.find_one({'email': user_email, 'role': 'admin'})
        if not admin_user:
            return jsonify({'error': 'Admin access required'}), 403

        # Get all products (no availability filter)
        products_cursor = db.products.find({}).sort('created_at', -1)
        products = []
        for p in products_cursor:
            products.append({
                'id': str(p.get('_id', '')),
                'name': p.get('name', ''),
                'price': p.get('price', 0),
                'quantity': p.get('quantity', 0),
                'available': p.get('available', True),
            })
        
        return jsonify({
            'products': products,
            'total_count': len(products)
        }), 200
    except Exception as e:
        print(f"Error fetching products: {e}")
        return jsonify({'error': str(e)}), 500


# ------------------------------------------------------------------
# Admin farmers endpoint
# ------------------------------------------------------------------
@admin_bp.route('/api/admin/farmers', methods=['GET'])
@token_required
def get_all_farmers():
    """API endpoint to get all farmers (admin only)"""
    try:
        db, _ = get_mongodb_db(admin_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500
        
        # Check if current user is admin
        user_email = request.user_email
        if not user_email:
            return jsonify({'error': 'User email not found in token'}), 401
        
        admin_user = db.users.find_one({'email': user_email, 'role': 'admin'})
        if not admin_user:
            return jsonify({'error': 'Admin access required'}), 403

        # Get all farmers
        farmers = list(db.users.find({'role': 'farmer'}))
        
        farmers_list = []
        for f in farmers:
            farmers_list.append({
                'id': str(f.get('_id', '')),
                'first_name': f.get('first_name', ''),
                'last_name': f.get('last_name', ''),
                'farm_name': f.get('farm_name', ''),
            })
        
        return jsonify({
            'farmers': farmers_list,
            'total_count': len(farmers_list)
        }), 200
    except Exception as e:
        print(f"Error fetching farmers: {e}")
        return jsonify({'error': str(e)}), 500


# ------------------------------------------------------------------
# Admin orders endpoint
# ------------------------------------------------------------------
@admin_bp.route('/api/admin/orders', methods=['GET'])
@token_required
def get_all_orders():
    """API endpoint to get all orders in the system (admin only)"""
    try:
        db, _ = get_mongodb_db(admin_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500
        
        # Check if current user is admin
        user_email = request.user_email
        if not user_email:
            return jsonify({'error': 'User email not found in token'}), 401
        
        admin_user = db.users.find_one({'email': user_email, 'role': 'admin'})
        if not admin_user:
            return jsonify({'error': 'Admin access required'}), 403

        # Get all orders with basic info
        orders = list(db.orders.find({}).sort('created_at', -1))
        
        orders_list = []
        for order in orders:
            orders_list.append({
                '_id': str(order.get('_id')),
                'user_id': str(order.get('user_id', '')),
                'total': order.get('total', 0),
                'total_amount': order.get('total_amount', 0),
                'status': order.get('status', 'pending'),
                'created_at': str(order.get('created_at', '')),
            })
        
        return jsonify({
            'orders': orders_list,
            'total_count': len(orders_list)
        }), 200
    except Exception as e:
        print(f"Error fetching orders: {e}")
        return jsonify({'error': str(e)}), 500


# ------------------------------------------------------------------
# Admin riders endpoint
# ------------------------------------------------------------------
@admin_bp.route('/api/admin/riders', methods=['GET', 'POST'])
@token_required
def admin_riders():
    try:
        from bson import ObjectId
        from user_model import User

        db, _ = get_mongodb_db(admin_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500

        user_email = request.user_email
        if not user_email:
            return jsonify({'error': 'User email not found in token'}), 401

        admin_user = db.users.find_one({'email': user_email, 'role': 'admin'})
        if not admin_user:
            return jsonify({'error': 'Admin access required'}), 403

        def _serialize_rider(doc):
            created_at = doc.get('created_at')
            updated_at = doc.get('updated_at')
            return {
                'id': str(doc.get('_id')),
                'user_id': doc.get('user_id'),
                'name': doc.get('name', ''),
                'email': doc.get('email', ''),
                'phone': doc.get('phone', ''),
                'barangay': doc.get('barangay', ''),
                'city': doc.get('city', ''),
                'province': doc.get('province', ''),
                'active': bool(doc.get('active', True)),
                'created_at': created_at.isoformat() if created_at else None,
                'updated_at': updated_at.isoformat() if updated_at else None,
            }

        if request.method == 'GET':
            riders = list(db.riders.find({}).sort('created_at', -1))
            rider_list = []
            active_count = 0
            for r in riders:
                is_active = bool(r.get('active', True))
                if is_active:
                    active_count += 1
                rider_list.append(_serialize_rider(r))
            return jsonify({'riders': rider_list, 'active_count': active_count, 'total_count': len(rider_list)}), 200

        data = request.get_json() or {}
        name = (data.get('name') or '').strip()
        email = (data.get('email') or '').strip().lower()
        password = (data.get('password') or '').strip()
        phone = (data.get('phone') or '').strip()
        barangay = (data.get('barangay') or '').strip()
        city = (data.get('city') or '').strip()
        province = (data.get('province') or '').strip()
        active = bool(data.get('active', True))

        if not all([name, email, password, phone, barangay, city, province]):
            return jsonify({'error': 'Name, email, password, phone, barangay, city, and province are required'}), 400

        if db.users.find_one({'email': email}):
            return jsonify({'error': 'Email already registered'}), 400

        name_parts = name.split()
        first_name = name_parts[0] if name_parts else name
        last_name = ' '.join(name_parts[1:]) if len(name_parts) > 1 else ''

        rider_user = User(
            email=email,
            first_name=first_name,
            last_name=last_name,
            phone=phone,
            role='rider',
        )
        rider_user.set_password(password)
        rider_user.save(db)

        rider_doc = {
            'user_id': rider_user.id,
            'name': name,
            'email': email,
            'phone': phone,
            'barangay': barangay,
            'city': city,
            'province': province,
            'active': active,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
        }

        result = db.riders.insert_one(rider_doc)
        rider_doc['_id'] = result.inserted_id
        return jsonify({'rider': _serialize_rider(rider_doc)}), 201
    except Exception as e:
        print(f"Error in admin riders: {e}")
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/riders/<rider_id>', methods=['PUT', 'DELETE'])
@token_required
def admin_rider_detail(rider_id):
    try:
        from bson import ObjectId
        from user_model import User

        db, _ = get_mongodb_db(admin_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500

        user_email = request.user_email
        if not user_email:
            return jsonify({'error': 'User email not found in token'}), 401

        admin_user = db.users.find_one({'email': user_email, 'role': 'admin'})
        if not admin_user:
            return jsonify({'error': 'Admin access required'}), 403

        if not ObjectId.is_valid(rider_id):
            return jsonify({'error': 'Invalid rider id'}), 400

        rider_oid = ObjectId(rider_id)
        rider_doc = db.riders.find_one({'_id': rider_oid})
        if not rider_doc:
            return jsonify({'error': 'Rider not found'}), 404

        if request.method == 'DELETE':
            db.riders.delete_one({'_id': rider_oid})
            return jsonify({'success': True}), 200

        data = request.get_json() or {}
        update_doc = {}
        for field in ('name', 'phone', 'barangay', 'city', 'province'):
            if field in data:
                update_doc[field] = (data.get(field) or '').strip()
        if 'active' in data:
            update_doc['active'] = bool(data.get('active'))

        password = (data.get('password') or '').strip()
        if password:
            user_doc = None
            if rider_doc.get('user_id'):
                user_doc = db.users.find_one({'id': rider_doc.get('user_id')})
            if not user_doc and rider_doc.get('email'):
                user_doc = db.users.find_one({'email': rider_doc.get('email')})
            if user_doc:
                rider_user = User.from_dict(user_doc)
                rider_user.set_password(password)
                rider_user.save(db)

        password = (data.get('password') or '').strip()
        if password:
            user_doc = None
            if rider_doc.get('user_id'):
                user_doc = db.users.find_one({'id': rider_doc.get('user_id')})
            if not user_doc and rider_doc.get('email'):
                user_doc = db.users.find_one({'email': rider_doc.get('email')})
            if user_doc:
                rider_user = User.from_dict(user_doc)
                rider_user.set_password(password)
                rider_user.save(db)

        if not update_doc:
            return jsonify({'error': 'No updates provided'}), 400

        update_doc['updated_at'] = datetime.utcnow()
        db.riders.update_one({'_id': rider_oid}, {'$set': update_doc})

        return jsonify({'success': True}), 200
    except Exception as e:
        print(f"Error updating rider: {e}")
        return jsonify({'error': str(e)}), 500


# ------------------------------------------------------------------
# Permit verification dashboard API
# ------------------------------------------------------------------
@admin_bp.route('/api/admin/verifications', methods=['GET'])
@token_required
def get_verifications_api():
    """API endpoint to get all verification submissions"""
    try:
        db, _ = get_mongodb_db(admin_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500
        
        # Check if current user is admin by verifying in database
        user_email = request.user_email
        if not user_email:
            return jsonify({'error': 'User email not found in token'}), 401
        
        admin_user = db.users.find_one({'email': user_email, 'role': 'admin'})
        if not admin_user:
            return jsonify({'error': 'Admin access required'}), 403
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500

        users_col = db.users
        all_users = list(users_col.find({'business_verification_ml': {'$exists': True, '$ne': None}}))

        verified_count = users_col.count_documents({'business_verification_ml': {'$exists': True, '$ne': None}, 'business_verification_status': 'verified'})
        rejected_count = users_col.count_documents({'business_verification_ml': {'$exists': True, '$ne': None}, 'business_verification_status': 'rejected'})

        verifications = []
        for u in all_users:
            ml = u.get('business_verification_ml', {})
            status = u.get('business_verification_status', 'rejected')
            verifications.append({
                'id': str(u.get('_id')),
                'farmer_name': f"{u.get('first_name', '')} {u.get('last_name', '')}".strip(),
                'farm_name': u.get('farm_name', 'N/A'),
                'email': u.get('email', 'N/A'),
                'status': status,
                'valid': ml.get('valid', False),
                'rejected': status == 'rejected',
                'confidence': ml.get('confidence', 0),
                'timestamp': ml.get('timestamp', 'N/A'),
                'extracted_text': ml.get('extracted_text', '')[:100],
                'quality_check': ml.get('quality_check', {}),
                'document_detection': ml.get('document_detection', {}),
                'permit_validation': ml.get('permit_validation', {}),
            })

        return jsonify({
            'verifications': verifications,
            'stats': {
                'total': len(all_users),
                'verified': verified_count,
                'rejected': rejected_count,
            }
        }), 200
    except Exception as e:
        print(f"Dashboard error: {e}")
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/user/verification-status', methods=['GET'])
@token_required
def get_user_verification_status():
    """Get current user's own verification status"""
    try:
        db, _ = get_mongodb_db(admin_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500

        user_email = request.user_email
        if not user_email:
            return jsonify({'error': 'User email not found in token'}), 401

        user = db.users.find_one({'email': user_email})
        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Only return if user has submitted verification or is a farmer
        if not user.get('business_verification_submitted_at') and user.get('role') != 'farmer':
            return jsonify({
                'status': 'not_submitted',
                'message': 'No verification submission found'
            }), 200

        ml = user.get('business_verification_ml', {})
        
        return jsonify({
            'status': 'found',
            'verification': {
                'id': str(user.get('_id')),
                'farmer_name': f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
                'farm_name': user.get('farm_name', 'N/A'),
                'email': user.get('email', 'N/A'),
                'verification_status': user.get('business_verification_status', 'pending'),
                'submitted_at': user.get('business_verification_submitted_at'),
                'confidence': ml.get('confidence') if ml else None,
                'valid': ml.get('valid') if ml else None,
                'extracted_text': ml.get('extracted_text', '') if ml else '',
                'quality_check': ml.get('quality_check', {}) if ml else {},
                'document_detection': ml.get('ml_prediction', {}) if ml else {},
                'permit_validation': ml.get('permit_validation', {}) if ml else {},
                'timestamp': ml.get('timestamp') if ml else None,
            }
        }), 200
    except Exception as e:
        print(f"User verification status error: {e}")
        return jsonify({'error': str(e)}), 500


# ------------------------------------------------------------------
# Permit Verification Records from Database
# ------------------------------------------------------------------
@admin_bp.route('/api/admin/permit-verifications', methods=['GET'])
@token_required
def get_permit_verifications_db():
    """Get permit verifications from MongoDB PermitVerification collection"""
    try:
        from models import PermitVerification, User as MongoUser
        
        # Check admin access
        admin_user = MongoUser.objects(email=request.user_email, role='admin').first()
        if not admin_user:
            return jsonify({'error': 'Admin access required'}), 403
        
        # Get query parameters
        status = request.args.get('status', '')  # 'verified', 'rejected'
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 20))
        
        # Build query
        query = {}
        if status and status in ['verified', 'rejected']:
            query['status'] = status
        
        # Get total count
        total = PermitVerification.objects(**query).count()
        
        # Get paginated results
        skip = (page - 1) * per_page
        records = PermitVerification.objects(**query).order_by('-created_at')[skip:skip+per_page]
        
        verifications = []
        for record in records:
            user_info = {
                'email': record.user_email,
                'name': record.user_name or 'N/A',
                'farm_name': record.user_farm_name or 'N/A',
            }
            
            verifications.append({
                'id': str(record.id),
                'user': user_info,
                'status': record.status,
                'confidence': record.confidence,
                'valid': record.valid,
                'permit_business_name': record.permit_business_name,
                'dti_business_name': record.dti_business_name,
                'ml_confidence': record.ml_confidence,
                'ml_is_permit': record.ml_is_permit,
                'qr_valid': record.qr_valid,
                'admin_notes': record.admin_notes,
                'image_filename': record.image_filename,
                'created_at': record.created_at.isoformat() if record.created_at else None,
                'reviewed_at': record.reviewed_at.isoformat() if record.reviewed_at else None,
            })
        
        # Get stats
        verified_count = PermitVerification.objects(status='verified').count()
        rejected_count = PermitVerification.objects(status='rejected').count()
        total_count = PermitVerification.objects.count()
        
        return jsonify({
            'verifications': verifications,
            'stats': {
                'total': total_count,
                'verified': verified_count,
                'rejected': rejected_count,
            },
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'pages': (total + per_page - 1) // per_page
            }
        }), 200
        
    except Exception as e:
        print(f"Permit verifications error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/permit-verifications/<verification_id>', methods=['GET'])
@token_required
def get_permit_verification_detail(verification_id):
    """Get full details of a specific permit verification"""
    try:
        from models import PermitVerification, User as MongoUser
        
        # Check admin access
        admin_user = MongoUser.objects(email=request.user_email, role='admin').first()
        if not admin_user:
            return jsonify({'error': 'Admin access required'}), 403
        
        record = PermitVerification.objects(id=verification_id).first()
        if not record:
            return jsonify({'error': 'Verification record not found'}), 404
        
        user_info = {
            'email': record.user_email,
            'name': record.user_name or 'N/A',
            'farm_name': record.user_farm_name or 'N/A',
        }
        
        return jsonify({
            'id': str(record.id),
            'user': user_info,
            'status': record.status,
            'confidence': record.confidence,
            'valid': record.valid,
            'permit_business_name': record.permit_business_name,
            'permit_owner_name': record.permit_owner_name,
            'dti_business_name': record.dti_business_name,
            'dti_owner_name': record.dti_owner_name,
            'ml_confidence': record.ml_confidence,
            'ml_is_permit': record.ml_is_permit,
            'qr_valid': record.qr_valid,
            'qr_data': record.qr_data,
            'image_filename': record.image_filename,
            'full_result': record.verification_result,
            'admin_notes': record.admin_notes,
            'reviewed_by': record.reviewed_by,
            'created_at': record.created_at.isoformat() if record.created_at else None,
            'reviewed_at': record.reviewed_at.isoformat() if record.reviewed_at else None,
        }), 200
        
    except Exception as e:
        print(f"Permit verification detail error: {e}")
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/permit-verifications/<verification_id>', methods=['PUT'])
@token_required
def update_permit_verification(verification_id):
    """Update permit verification status and notes"""
    try:
        from models import PermitVerification, User as MongoUser
        from bson import ObjectId
        
        # Check admin access
        admin_user = MongoUser.objects(email=request.user_email, role='admin').first()
        if not admin_user:
            return jsonify({'error': 'Admin access required'}), 403
        
        data = request.get_json()
        new_status = data.get('status')  # 'verified', 'rejected', 'under_review'
        admin_notes = data.get('admin_notes', '')
        
        if new_status not in ['pending', 'verified', 'rejected', 'under_review']:
            return jsonify({'error': 'Invalid status'}), 400
        
        record = PermitVerification.objects(id=verification_id).first()
        if not record:
            return jsonify({'error': 'Verification record not found'}), 404
        
        # Update record
        record.status = new_status
        record.admin_notes = admin_notes
        record.reviewed_by = request.user_email
        record.reviewed_at = datetime.utcnow()
        record.save()
        
        # If approving, also update the user's role to farmer
        if new_status == 'verified' and record.user_email:
            db, _ = get_mongodb_db(admin_bp)
            if db:
                db.users.update_one(
                    {'email': record.user_email},
                    {'$set': {'role': 'farmer', 'business_verification_status': 'verified'}}
                )
        
        return jsonify({
            'id': str(record.id),
            'status': record.status,
            'message': f'Verification {new_status} successfully',
        }), 200
        
    except Exception as e:
        print(f"Update permit verification error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500



@admin_bp.route('/admin/permit-dashboard')
@login_required
def permit_dashboard():
    try:
        db, _ = get_mongodb_db(admin_bp)
        if db is None:
            flash('Database connection failed.', 'error')
            return redirect('/')

        users_col = db.users
        all_users = list(users_col.find({'business_verification_ml': {'$exists': True, '$ne': None}}))

        verified_count = users_col.count_documents({'business_verification_ml': {'$exists': True, '$ne': None}, 'business_verification_status': 'verified'})
        rejected_count = users_col.count_documents({'business_verification_ml': {'$exists': True, '$ne': None}, 'business_verification_status': 'rejected'})

        verifications = []
        for u in all_users:
            ml = u.get('business_verification_ml', {})
            status = u.get('business_verification_status', 'rejected')
            verifications.append({
                'id': str(u.get('_id')),
                'farmer_name': f"{u.get('first_name', '')} {u.get('last_name', '')}".strip(),
                'farm_name': u.get('farm_name', 'N/A'),
                'email': u.get('email', 'N/A'),
                'status': status,
                'valid': ml.get('valid', False),
                'rejected': status == 'rejected',
                'confidence': ml.get('confidence', 0),
                'timestamp': ml.get('timestamp', 'N/A'),
                'extracted_text': ml.get('extracted_text', '')[:100],
                'quality_check': ml.get('quality_check', {}),
                'document_detection': ml.get('document_detection', {}),
                'permit_validation': ml.get('permit_validation', {}),
            })

        return render_template(
            'permit_verification_dashboard.html',
            verifications=verifications,
            verified_count=verified_count,
            rejected_count=rejected_count,
            total_submissions=len(all_users),
        )
    except Exception as e:
        print(f"Dashboard error: {e}")
        flash('Error loading dashboard', 'danger')
        return redirect('/')


@admin_bp.route('/admin/permit-details/<user_id>')
@login_required
def get_permit_details(user_id):
    try:
        db, _ = get_mongodb_db(admin_bp)
        if db is None:
            return {'error': 'Database connection failed'}, 500

        user = db.users.find_one({'_id': user_id, 'business_verification_ml': {'$exists': True, '$ne': None}})
        if not user:
            return {'error': 'User not found or has no verification submission'}, 404

        ml = user.get('business_verification_ml', {})
        return {
            'farmer_name': f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
            'farm_name': user.get('farm_name', 'N/A'),
            'email': user.get('email', 'N/A'),
            'phone': user.get('phone', 'N/A'),
            'status': user.get('business_verification_status', 'rejected'),
            'confidence': ml.get('confidence', 0),
            'extracted_text': ml.get('extracted_text', ''),
            'quality_check': ml.get('quality_check', {}),
            'document_detection': ml.get('ml_prediction', {}),
            'permit_validation': ml.get('permit_validation', {}),
            'timestamp': ml.get('timestamp', ''),
            'full_result': ml,
        }
    except Exception as e:
        return {'error': str(e)}, 500


# ------------------------------------------------------------------
# Debug endpoints
# ------------------------------------------------------------------
@admin_bp.route('/debug/database-status', methods=['GET'])
@login_required
def debug_database_status():
    try:
        from models import User as MEUser, Product

        db, _ = get_mongodb_db(admin_bp)
        me_count = MEUser.objects().count()
        pymongo_count = db.users.count_documents({}) if db else 0

        me_user = MEUser.objects(email=current_user.email).first()
        pymongo_user = db.users.find_one({'email': current_user.email}) if db else None
        ensured = ensure_mongoengine_user(current_user)

        return {
            'status': 'ok',
            'mongoengine_users': me_count,
            'pymongo_users': pymongo_count,
            'me_user_found': me_user is not None,
            'pymongo_user_found': pymongo_user is not None,
            'ensure_result': ensured is not None,
        }
    except Exception as e:
        import traceback
        return {'error': str(e), 'traceback': traceback.format_exc()}, 500


@admin_bp.route('/debug/user-info', methods=['GET'])
@login_required
def debug_user_info():
    try:
        from models import User as MEUser, Product

        db, _ = get_mongodb_db(admin_bp)
        me_user = ensure_mongoengine_user(current_user)
        pymongo_user = db.users.find_one({'email': current_user.email}) if db else None
        mongoengine_user = MEUser.objects(email=current_user.email).first()

        products = list(Product.objects(farmer=me_user)) if me_user else []

        return {
            'current_user': {
                'email': current_user.email,
                'type': type(current_user).__name__,
                'role': getattr(current_user, 'role', 'user'),
                'authenticated': current_user.is_authenticated,
            },
            'mongoengine_user': {
                'found': mongoengine_user is not None,
                'email': mongoengine_user.email if mongoengine_user else None,
                'role': mongoengine_user.role if mongoengine_user else None,
                'id': str(mongoengine_user.id) if mongoengine_user else None,
            },
            'pymongo_user': {
                'found': pymongo_user is not None,
                'email': pymongo_user.get('email') if pymongo_user else None,
                'role': pymongo_user.get('role') if pymongo_user else None,
            },
            'ensure_mongoengine_user_result': {
                'found': me_user is not None,
                'email': me_user.email if me_user else None,
                'role': me_user.role if me_user else None,
                'id': str(me_user.id) if me_user else None,
            },
            'products_count': len(products),
            'products': [{'name': p.name, 'id': str(p.id)} for p in products],
        }
    except Exception as e:
        import traceback
        return {'error': str(e), 'traceback': traceback.format_exc()}, 500


# ------------------------------------------------------------------
# Admin Reports / Analytics API
# ------------------------------------------------------------------
@admin_bp.route('/api/admin/reports', methods=['GET'])
@token_required
def get_admin_reports():
    """Aggregate report data: revenue over time, order status, top products, top farmers, daily volume"""
    try:
        db, _ = get_mongodb_db(admin_bp)
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500

        user_email = request.user_email
        if not user_email:
            return jsonify({'error': 'User email not found in token'}), 401
        admin_user = db.users.find_one({'email': user_email, 'role': 'admin'})
        if not admin_user:
            return jsonify({'error': 'Admin access required'}), 403

        # --- Time range (default last 30 days) ---
        days = int(request.args.get('days', 30))
        cutoff = datetime.utcnow() - timedelta(days=days)

        all_orders = list(db.orders.find({}).sort('created_at', 1))

        # ============================================================
        # 1) Revenue over time (daily, for the selected period)
        # ============================================================
        revenue_by_day = defaultdict(float)
        orders_by_day = defaultdict(int)
        for o in all_orders:
            created = o.get('created_at')
            if not created:
                continue
            if isinstance(created, str):
                try:
                    created = datetime.fromisoformat(created)
                except Exception:
                    continue
            if created >= cutoff:
                day_key = created.strftime('%Y-%m-%d')
                amount = float(o.get('total_amount') or o.get('total') or 0)
                revenue_by_day[day_key] += amount
                orders_by_day[day_key] += 1

        # Fill missing days with 0
        revenue_timeline = []
        current_day = cutoff
        while current_day <= datetime.utcnow():
            key = current_day.strftime('%Y-%m-%d')
            revenue_timeline.append({
                'date': key,
                'revenue': round(revenue_by_day.get(key, 0), 2),
                'orders': orders_by_day.get(key, 0),
            })
            current_day += timedelta(days=1)

        # ============================================================
        # 2) Order status breakdown (all time)
        # ============================================================
        status_counts = defaultdict(int)
        for o in all_orders:
            status_counts[o.get('status', 'unknown')] += 1
        order_status_data = [{'status': s, 'count': c} for s, c in status_counts.items()]

        # ============================================================
        # 3) Top 10 products by revenue
        # ============================================================
        product_revenue = defaultdict(lambda: {'revenue': 0, 'quantity_sold': 0, 'name': ''})
        for o in all_orders:
            items = o.get('items', [])
            for item in items:
                pid = item.get('product_id', item.get('id', 'unknown'))
                name = item.get('name', 'Unknown Product')
                qty = int(item.get('quantity', 1))
                price = float(item.get('price', 0))
                product_revenue[pid]['revenue'] += price * qty
                product_revenue[pid]['quantity_sold'] += qty
                product_revenue[pid]['name'] = name

        top_products = sorted(product_revenue.values(), key=lambda x: x['revenue'], reverse=True)[:10]
        for p in top_products:
            p['revenue'] = round(p['revenue'], 2)

        # ============================================================
        # 4) Revenue by farmer (top 10)
        # ============================================================
        # Build product->farmer mapping
        all_products = list(db.products.find({}))
        product_farmer_map = {}
        farmer_names = {}
        for prod in all_products:
            pid = str(prod.get('_id', ''))
            farmer_ref = prod.get('farmer') or prod.get('farmer_user_id')
            if farmer_ref:
                fid = str(farmer_ref)
                product_farmer_map[pid] = fid

        # Get farmer names
        farmers = list(db.users.find({'role': 'farmer'}))
        for f in farmers:
            fid = str(f.get('_id', ''))
            farmer_names[fid] = f"{f.get('first_name', '')} {f.get('last_name', '')}".strip() or f.get('farm_name', 'Unknown')

        farmer_revenue = defaultdict(float)
        for o in all_orders:
            for item in o.get('items', []):
                pid = item.get('product_id', '')
                fid = product_farmer_map.get(pid)
                if fid:
                    qty = int(item.get('quantity', 1))
                    price = float(item.get('price', 0))
                    farmer_revenue[fid] += price * qty

        top_farmers = sorted(
            [{'farmer_id': fid, 'name': farmer_names.get(fid, 'Unknown'), 'revenue': round(rev, 2)}
             for fid, rev in farmer_revenue.items()],
            key=lambda x: x['revenue'], reverse=True
        )[:10]

        # ============================================================
        # 5) Monthly revenue comparison (last 6 months)
        # ============================================================
        monthly_cutoff = datetime.utcnow() - timedelta(days=180)
        monthly_revenue = defaultdict(float)
        monthly_orders = defaultdict(int)
        for o in all_orders:
            created = o.get('created_at')
            if not created:
                continue
            if isinstance(created, str):
                try:
                    created = datetime.fromisoformat(created)
                except Exception:
                    continue
            if created >= monthly_cutoff:
                month_key = created.strftime('%Y-%m')
                amount = float(o.get('total_amount') or o.get('total') or 0)
                monthly_revenue[month_key] += amount
                monthly_orders[month_key] += 1

        monthly_data = []
        for i in range(5, -1, -1):
            d = datetime.utcnow() - timedelta(days=30 * i)
            key = d.strftime('%Y-%m')
            monthly_data.append({
                'month': key,
                'revenue': round(monthly_revenue.get(key, 0), 2),
                'orders': monthly_orders.get(key, 0),
            })

        # ============================================================
        # 6) Payment method breakdown
        # ============================================================
        payment_counts = defaultdict(int)
        payment_revenue = defaultdict(float)
        for o in all_orders:
            method = o.get('payment_method', 'unknown')
            payment_counts[method] += 1
            payment_revenue[method] += float(o.get('total_amount') or o.get('total') or 0)
        payment_data = [
            {'method': m, 'count': payment_counts[m], 'revenue': round(payment_revenue[m], 2)}
            for m in payment_counts
        ]

        # ============================================================
        # 7) Summary KPIs
        # ============================================================
        total_revenue = sum(float(o.get('total_amount') or o.get('total') or 0) for o in all_orders)
        completed_orders = sum(1 for o in all_orders if o.get('status') in ('completed', 'delivered'))
        cancelled_orders = sum(1 for o in all_orders if o.get('status') == 'cancelled')
        avg_order_value = total_revenue / len(all_orders) if all_orders else 0

        # Recent period vs previous period comparison
        recent_cutoff = datetime.utcnow() - timedelta(days=days)
        prev_cutoff = recent_cutoff - timedelta(days=days)
        recent_revenue = 0
        prev_revenue = 0
        for o in all_orders:
            created = o.get('created_at')
            if not created:
                continue
            if isinstance(created, str):
                try:
                    created = datetime.fromisoformat(created)
                except Exception:
                    continue
            amount = float(o.get('total_amount') or o.get('total') or 0)
            if created >= recent_cutoff:
                recent_revenue += amount
            elif created >= prev_cutoff:
                prev_revenue += amount

        revenue_growth = 0
        if prev_revenue > 0:
            revenue_growth = round(((recent_revenue - prev_revenue) / prev_revenue) * 100, 1)

        return jsonify({
            'revenue_timeline': revenue_timeline,
            'order_status': order_status_data,
            'top_products': top_products,
            'top_farmers': top_farmers,
            'monthly_data': monthly_data,
            'payment_breakdown': payment_data,
            'kpis': {
                'total_revenue': round(total_revenue, 2),
                'total_orders': len(all_orders),
                'completed_orders': completed_orders,
                'cancelled_orders': cancelled_orders,
                'avg_order_value': round(avg_order_value, 2),
                'revenue_growth_pct': revenue_growth,
                'active_farmers': len(farmers),
                'total_products': len(all_products),
            }
        }), 200

    except Exception as e:
        print(f"Admin reports error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ------------------------------------------------------------------
# Geocode proxy
# ------------------------------------------------------------------
@admin_bp.route('/api/geocode', methods=['POST'])
def geocode():
    try:
        import requests as http_requests

        data = request.get_json()
        lat = data.get('lat')
        lon = data.get('lon')
        if not lat or not lon:
            return {'error': 'Missing coordinates'}, 400

        resp = http_requests.get(
            f'https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}&zoom=18&addressdetails=1',
            headers={'Accept': 'application/json', 'User-Agent': 'FarmtoClick/1.0'},
            timeout=10,
        )
        if resp.status_code == 200:
            return resp.json()
        return {'error': 'Geocoding failed'}, resp.status_code
    except Exception as e:
        print(f"Geocoding error: {e}")
        return {'error': str(e)}, 500
