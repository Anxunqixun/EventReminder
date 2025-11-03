from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import datetime
import os
from dateutil import parser

app = Flask(__name__)
CORS(app)

# 数据库初始化
def init_db():
    conn = sqlite3.connect('events.db')
    cursor = conn.cursor()
    # 创建events表
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        due_at DATETIME,
        time_hint TEXT,
        priority INTEGER DEFAULT 2,
        status TEXT DEFAULT 'active',
        last_modified DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # 创建event_actions表用于记录事件完成历史
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS event_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        action_type TEXT NOT NULL, -- 'complete' 或 'reopen'
        action_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        comment TEXT,
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    )
    ''')
    
    # 创建索引
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_due_at ON events(due_at)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_event_id ON event_actions(event_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_action_time ON event_actions(action_time)')
    
    conn.commit()
    conn.close()

# 初始化数据库
init_db()

# 工具函数
def dict_factory(cursor, row):
    d = {}
    for idx, col in enumerate(cursor.description):
        d[col[0]] = row[idx]
    return d

def format_datetime(dt):
    if isinstance(dt, str):
        return dt
    return dt.isoformat() + 'Z'

# API端点
@app.route('/api/v1/events', methods=['GET'])
def get_events():
    conn = sqlite3.connect('events.db')
    conn.row_factory = dict_factory
    cursor = conn.cursor()
    
    status = request.args.get('status', 'active')
    query = 'SELECT * FROM events WHERE status = ? ORDER BY due_at ASC'
    params = [status]
    
    # 如果status为'all'，获取所有事件
    if status == 'all':
        query = 'SELECT * FROM events ORDER BY due_at ASC'
        params = []
    
    cursor.execute(query, params)
    events = cursor.fetchall()
    conn.close()
    
    # 格式化日期时间
    for event in events:
        event['created_at'] = format_datetime(event['created_at'])
        event['due_at'] = format_datetime(event['due_at'])
        event['last_modified'] = format_datetime(event['last_modified'])
    
    return jsonify(events)

@app.route('/api/v1/events/<int:id>', methods=['GET'])
def get_event(id):
    conn = sqlite3.connect('events.db')
    conn.row_factory = dict_factory
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM events WHERE id = ?', (id,))
    event = cursor.fetchone()
    conn.close()
    
    if event:
        event['created_at'] = format_datetime(event['created_at'])
        event['due_at'] = format_datetime(event['due_at'])
        event['last_modified'] = format_datetime(event['last_modified'])
        return jsonify(event)
    return jsonify({'error': 'Event not found'}), 404

@app.route('/api/v1/events', methods=['POST'])
def create_event():
    data = request.get_json()
    
    # 验证必填字段
    if not data.get('title'):
        return jsonify({'error': 'Title is required'}), 400
    
    # 验证到期时间
    try:
        due_at = parser.parse(data['due_at']) if data.get('due_at') else datetime.datetime.now()
    except:
        return jsonify({'error': 'Invalid due date format'}), 400
    
    conn = sqlite3.connect('events.db')
    cursor = conn.cursor()
    cursor.execute('''
    INSERT INTO events (title, description, due_at, time_hint, priority, status)
    VALUES (?, ?, ?, ?, ?, ?)
    ''', (
        data['title'],
        data.get('description', ''),
        due_at.isoformat(),
        data.get('time_hint', ''),
        data.get('priority', 2),
        'active'
    ))
    
    event_id = cursor.lastrowid
    conn.commit()
    
    # 获取创建的事件
    cursor.execute('SELECT * FROM events WHERE id = ?', (event_id,))
    event = cursor.fetchone()
    conn.close()
    
    event_dict = dict_factory(cursor, event)
    event_dict['created_at'] = format_datetime(event_dict['created_at'])
    event_dict['due_at'] = format_datetime(event_dict['due_at'])
    event_dict['last_modified'] = format_datetime(event_dict['last_modified'])
    
    return jsonify(event_dict), 201

@app.route('/api/v1/events/<int:id>', methods=['PUT'])
def update_event(id):
    data = request.get_json()
    
    # 验证必填字段
    if 'title' in data and not data['title']:
        return jsonify({'error': 'Title cannot be empty'}), 400
    
    conn = sqlite3.connect('events.db')
    cursor = conn.cursor()
    
    # 检查事件是否存在
    cursor.execute('SELECT * FROM events WHERE id = ?', (id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({'error': 'Event not found'}), 404
    
    # 准备更新字段
    update_fields = []
    params = []
    
    if 'title' in data:
        update_fields.append('title = ?')
        params.append(data['title'])
    if 'description' in data:
        update_fields.append('description = ?')
        params.append(data['description'])
    if 'due_at' in data:
        try:
            due_at = parser.parse(data['due_at'])
            update_fields.append('due_at = ?')
            params.append(due_at.isoformat())
        except:
            conn.close()
            return jsonify({'error': 'Invalid due date format'}), 400
    if 'time_hint' in data:
        update_fields.append('time_hint = ?')
        params.append(data['time_hint'])
    if 'priority' in data:
        update_fields.append('priority = ?')
        params.append(data['priority'])
    if 'status' in data:
        update_fields.append('status = ?')
        params.append(data['status'])
    
    # 更新最后修改时间
    update_fields.append('last_modified = CURRENT_TIMESTAMP')
    params.append(id)
    
    # 执行更新
    query = f'UPDATE events SET {', '.join(update_fields)} WHERE id = ?'
    cursor.execute(query, params)
    conn.commit()
    
    # 获取更新后的事件
    cursor.execute('SELECT * FROM events WHERE id = ?', (id,))
    event = cursor.fetchone()
    conn.close()
    
    event_dict = dict_factory(cursor, event)
    event_dict['created_at'] = format_datetime(event_dict['created_at'])
    event_dict['due_at'] = format_datetime(event_dict['due_at'])
    event_dict['last_modified'] = format_datetime(event_dict['last_modified'])
    
    return jsonify(event_dict)

@app.route('/api/v1/events/<int:id>/complete', methods=['POST'])
def complete_event(id):
    data = request.get_json() or {}
    comment = data.get('comment', '')
    
    conn = sqlite3.connect('events.db')
    cursor = conn.cursor()
    
    # 检查事件是否存在且为active状态
    cursor.execute('SELECT * FROM events WHERE id = ? AND status = ?', (id, 'active'))
    if not cursor.fetchone():
        conn.close()
        return jsonify({'error': 'Event not found or already completed'}), 404
    
    try:
        # 更新事件状态为completed
        cursor.execute('UPDATE events SET status = ?, last_modified = CURRENT_TIMESTAMP WHERE id = ?', 
                      ('completed', id))
        
        # 记录完成动作到event_actions表
        cursor.execute('INSERT INTO event_actions (event_id, action_type, comment) VALUES (?, ?, ?)',
                      (id, 'complete', comment))
        
        conn.commit()
        
        # 获取更新后的事件
        cursor.execute('SELECT * FROM events WHERE id = ?', (id,))
        event = cursor.fetchone()
        conn.close()
        
        event_dict = dict_factory(cursor, event)
        event_dict['created_at'] = format_datetime(event_dict['created_at'])
        event_dict['due_at'] = format_datetime(event_dict['due_at'])
        event_dict['last_modified'] = format_datetime(event_dict['last_modified'])
        
        return jsonify(event_dict)
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({'error': str(e)}), 500

@app.route('/api/v1/events/<int:id>/reopen', methods=['POST'])
def reopen_event(id):
    data = request.get_json() or {}
    comment = data.get('comment', '')
    
    conn = sqlite3.connect('events.db')
    cursor = conn.cursor()
    
    # 检查事件是否存在且为completed状态
    cursor.execute('SELECT * FROM events WHERE id = ? AND status = ?', (id, 'completed'))
    if not cursor.fetchone():
        conn.close()
        return jsonify({'error': 'Event not found or not in completed status'}), 404
    
    try:
        # 更新事件状态为active
        cursor.execute('UPDATE events SET status = ?, last_modified = CURRENT_TIMESTAMP WHERE id = ?', 
                      ('active', id))
        
        # 记录重新打开动作到event_actions表
        cursor.execute('INSERT INTO event_actions (event_id, action_type, comment) VALUES (?, ?, ?)',
                      (id, 'reopen', comment))
        
        conn.commit()
        
        # 获取更新后的事件
        cursor.execute('SELECT * FROM events WHERE id = ?', (id,))
        event = cursor.fetchone()
        conn.close()
        
        event_dict = dict_factory(cursor, event)
        event_dict['created_at'] = format_datetime(event_dict['created_at'])
        event_dict['due_at'] = format_datetime(event_dict['due_at'])
        event_dict['last_modified'] = format_datetime(event_dict['last_modified'])
        
        return jsonify(event_dict)
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({'error': str(e)}), 500

@app.route('/api/v1/events/<int:id>/actions', methods=['GET'])
def get_event_actions(id):
    conn = sqlite3.connect('events.db')
    conn.row_factory = dict_factory
    cursor = conn.cursor()
    
    # 检查事件是否存在
    cursor.execute('SELECT * FROM events WHERE id = ?', (id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({'error': 'Event not found'}), 404
    
    # 获取事件的所有动作历史
    cursor.execute('SELECT * FROM event_actions WHERE event_id = ? ORDER BY action_time DESC', (id,))
    actions = cursor.fetchall()
    conn.close()
    
    # 格式化时间
    for action in actions:
        action['action_time'] = format_datetime(action['action_time'])
    
    return jsonify(actions)

@app.route('/api/v1/getLine', methods=['GET'])
def get_line():
    # 返回固定的文字内容
    return jsonify({'text': '愿你每一天都能笑容灿烂，事事顺心，天天开心。'})

@app.route('/api/v1/events/<int:id>', methods=['DELETE'])
def delete_event(id):
    conn = sqlite3.connect('events.db')
    cursor = conn.cursor()
    
    # 检查事件是否存在
    cursor.execute('SELECT * FROM events WHERE id = ?', (id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({'error': 'Event not found'}), 404
    
    # 软删除
    cursor.execute('UPDATE events SET status = ? WHERE id = ?', ('deleted', id))
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'Event deleted successfully'})

# 静态文件服务
@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/<path:path>')
def static_files(path):
    return app.send_static_file(path)

if __name__ == '__main__':
    # 确保static目录存在
    if not os.path.exists('static'):
        os.makedirs('static')
    app.run(debug=True, host='0.0.0.0', port=5001)