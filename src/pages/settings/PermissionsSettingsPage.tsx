/**
 * Permissions Settings Page - Phân quyền Shop
 * Hiển thị danh sách nhân sự phòng ban Vận hành Shopee
 */

import { useState, useEffect } from 'react';
import { Shield, Users, Mail, Phone, Calendar, Search, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { SimpleDataTable, CellText } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface StaffMember {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  join_date: string | null;
  created_at: string;
}

export default function PermissionsSettingsPage() {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [filteredList, setFilteredList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchStaffList = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sys_profiles')
        .select('id, email, full_name, phone, join_date, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStaffList(data || []);
      setFilteredList(data || []);
    } catch (err) {
      console.error('Error fetching staff list:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaffList();
  }, []);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredList(staffList);
      return;
    }
    const term = searchTerm.toLowerCase();
    const filtered = staffList.filter(
      (staff) =>
        staff.full_name?.toLowerCase().includes(term) ||
        staff.email.toLowerCase().includes(term) ||
        staff.phone?.includes(term)
    );
    setFilteredList(filtered);
  }, [searchTerm, staffList]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('vi-VN');
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  const columns = [
    {
      key: 'staff',
      header: 'Nhân sự',
      width: '280px',
      render: (item: StaffMember) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-sm font-medium">
              {getInitials(item.full_name, item.email)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-medium text-slate-800 truncate">
              {item.full_name || 'Chưa cập nhật'}
            </p>
            <p className="text-xs text-slate-500 truncate">{item.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Số điện thoại',
      width: '150px',
      render: (item: StaffMember) => (
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-slate-400" />
          <CellText muted={!item.phone}>{item.phone || '—'}</CellText>
        </div>
      ),
    },
    {
      key: 'join_date',
      header: 'Ngày tham gia',
      width: '140px',
      render: (item: StaffMember) => (
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <CellText muted={!item.join_date}>{formatDate(item.join_date)}</CellText>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: '120px',
      render: () => (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          Hoạt động
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Phân quyền Shop</h1>
            <p className="text-sm text-slate-500">
              Danh sách nhân sự phòng ban Vận hành Shopee
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchStaffList}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Làm mới
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{staffList.length}</p>
              <p className="text-sm text-slate-500">Tổng nhân sự</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Mail className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {staffList.filter((s) => s.email).length}
              </p>
              <p className="text-sm text-slate-500">Đã xác thực email</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Phone className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {staffList.filter((s) => s.phone).length}
              </p>
              <p className="text-sm text-slate-500">Có số điện thoại</p>
            </div>
          </div>
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Search Bar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Tìm kiếm theo tên, email hoặc số điện thoại..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white"
              />
            </div>
            <p className="text-sm text-slate-500">
              Hiển thị {filteredList.length} / {staffList.length} nhân sự
            </p>
          </div>
        </div>

        {/* Table */}
        <SimpleDataTable
          columns={columns}
          data={filteredList}
          keyExtractor={(item) => item.id}
          loading={loading}
          loadingMessage="Đang tải danh sách nhân sự..."
          emptyMessage="Không tìm thấy nhân sự nào"
          emptyDescription={
            searchTerm
              ? 'Thử tìm kiếm với từ khóa khác'
              : 'Chưa có nhân sự nào trong hệ thống'
          }
        />
      </div>
    </div>
  );
}
