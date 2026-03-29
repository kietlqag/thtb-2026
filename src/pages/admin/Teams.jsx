import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, message, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { database } from '../../services/firebase/config';
import { ref, get, set, remove } from 'firebase/database';

// Hàm sinh id từ tên đội
function generateTeamId(name) {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // bỏ dấu
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, '') // chỉ giữ chữ, số, khoảng trắng
    .trim()
    .replace(/\s+/g, '_');
}

function Teams() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [editingTeam, setEditingTeam] = useState(null);

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      const teamsRef = ref(database, 'teams');
      const snapshot = await get(teamsRef);
      if (snapshot.exists()) {
        const teamsData = Object.entries(snapshot.val()).map(([id, data]) => ({
          id,
          ...data
        }));
        setTeams(teamsData);
      } else {
        setTeams([]);
      }
    } catch (error) {
      message.error('Lỗi khi tải danh sách đội thi');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingTeam(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingTeam(record);
    form.setFieldsValue({
      name: record.name,
      id: record.id,
      description: record.description || ''
    });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await remove(ref(database, `teams/${id}`));
      message.success('Xóa đội thi thành công');
      fetchTeams();
    } catch (error) {
      message.error('Lỗi khi xóa đội thi');
    }
  };

  const handleSubmit = async (values) => {
    try {
      let id;
      if (editingTeam) {
        // Giữ nguyên id cũ khi sửa
        id = editingTeam.id;
      } else {
        // Sinh id mới khi tạo
        id = generateTeamId(values.name);
      }
      const teamData = { id, name: values.name, description: values.description || '' };
      await set(ref(database, `teams/${id}`), teamData);
      message.success(editingTeam ? 'Cập nhật đội thi thành công' : 'Thêm đội thi thành công');
      setModalVisible(false);
      fetchTeams();
    } catch (error) {
      message.error('Lỗi khi lưu đội thi');
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: 'Tên đội',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Mô tả',
      dataIndex: 'description',
      key: 'description',
      render: (text) => text || <span style={{ color: '#aaa' }}>Không có</span>
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            Sửa
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            Xóa
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAdd}
        >
          Thêm đội thi
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={teams}
        rowKey="id"
        loading={loading}
      />

      <Modal
        title={editingTeam ? 'Sửa đội thi' : 'Thêm đội thi'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="name"
            label="Tên đội"
            rules={[{ required: true, message: 'Vui lòng nhập tên đội' }]}
          >
            <Input
              placeholder="Nhập tên đội"
              disabled={!!editingTeam}
              onChange={e => {
                if (!editingTeam) {
                  const id = generateTeamId(e.target.value);
                  form.setFieldsValue({ id });
                }
              }}
            />
          </Form.Item>
          <Form.Item
            name="id"
            label="ID (tự sinh)"
          >
            <Input disabled placeholder="ID sẽ tự sinh từ tên đội" />
          </Form.Item>
          <Form.Item
            name="description"
            label="Mô tả"
          >
            <Input.TextArea placeholder="Nhập mô tả cho đội (nếu có)" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingTeam ? 'Cập nhật' : 'Thêm'}
              </Button>
              <Button onClick={() => setModalVisible(false)}>
                Hủy
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Teams; 