import uuid
from datetime import datetime


def create_delivery_order(order_id, pickup_address, dropoff_address):
    tracking_id = f"LM-{uuid.uuid4().hex[:12]}"
    return {
        'tracking_id': tracking_id,
        'status': 'ready_for_ship',
        'created_at': datetime.utcnow(),
    }


def get_delivery_status(tracking_id):
    return {
        'tracking_id': tracking_id,
        'status': 'on_the_way',
        'updated_at': datetime.utcnow(),
    }
