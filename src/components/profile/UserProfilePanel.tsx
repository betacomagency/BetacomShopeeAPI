import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { User, Lock, Save, Phone, Mail, UserCircle, Calendar } from 'lucide-react';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  join_date: string | null;
  created_at: string;
}

export default function UserProfilePanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  
  // Form states
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  
  // Password states
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (user?.id) {
      loadProfile();
    }
  }, [user?.id]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sys_profiles')
        .select('*')
        .eq('id', user!.id)
        .single();

      if (error) throw error;

      setProfile(data);
      setFullName(data.full_name || '');
      setPhone(data.phone || '');
    } catch (error) {
      console.error('Error loading profile:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể tải thông tin cá nhân',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      setSaving(true);
      
      const updates = {
        full_name: fullName,
        phone: phone,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('sys_profiles')
        .update(updates)
        .eq('id', user!.id);

      if (error) throw error;

      toast({
        title: 'Thành công',
        description: 'Đã cập nhật thông tin cá nhân',
      });
      
      // Update local state
      if (profile) {
        setProfile({ ...profile, ...updates });
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể cập nhật thông tin',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng nhập mật khẩu mới',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: 'Lỗi',
        description: 'Mật khẩu phải có ít nhất 6 ký tự',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Lỗi',
        description: 'Mật khẩu xác nhận không khớp',
        variant: 'destructive',
      });
      return;
    }

    try {
      setChangingPassword(true);
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast({
        title: 'Thành công',
        description: 'Đã đổi mật khẩu thành công',
      });
      
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Error changing password:', error);
      toast({
        title: 'Lỗi',
        description: (error as Error).message || 'Không thể đổi mật khẩu',
        variant: 'destructive',
      });
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Thông tin cá nhân</CardTitle>
          <CardDescription>Đang tải thông tin...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <Spinner />
        </CardContent>
      </Card>
    );
  }

  // Format date helper
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('vi-VN');
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Thông tin cơ bản */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCircle className="w-5 h-5" />
            Thông tin tài khoản
          </CardTitle>
          <CardDescription>
            Quản lý thông tin cá nhân của bạn
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                id="email" 
                value={profile?.email || ''} 
                disabled 
                className="pl-9 bg-slate-50"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fullName">Họ và tên</Label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                id="fullName" 
                value={fullName} 
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nhập họ và tên"
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Số điện thoại</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                id="phone" 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Nhập số điện thoại"
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Ngày tham gia</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                value={formatDate(profile?.join_date || profile?.created_at || null)}
                disabled 
                className="pl-9 bg-slate-50"
              />
            </div>
          </div>

          <div className="pt-4">
            <Button 
              onClick={handleUpdateProfile} 
              disabled={saving}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {saving ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Đang lưu...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Lưu thay đổi
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Đổi mật khẩu */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Bảo mật
          </CardTitle>
          <CardDescription>
            Đổi mật khẩu đăng nhập
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">Mật khẩu mới</Label>
            <Input 
              id="newPassword" 
              type="password" 
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nhập mật khẩu mới"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Xác nhận mật khẩu</Label>
            <Input 
              id="confirmPassword" 
              type="password" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu mới"
            />
          </div>

          <div className="pt-4">
            <Button 
              onClick={handleChangePassword} 
              disabled={changingPassword || !newPassword}
              variant="outline"
            >
              {changingPassword ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Đang xử lý...
                </>
              ) : (
                'Đổi mật khẩu'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
