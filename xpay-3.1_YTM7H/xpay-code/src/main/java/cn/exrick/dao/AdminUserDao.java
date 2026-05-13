package cn.exrick.dao;

import cn.exrick.bean.AdminUser;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AdminUserDao extends JpaRepository<AdminUser, Long> {

    Optional<AdminUser> findByOpenid(String openid);

    List<AdminUser> findByStatus(Integer status);

    List<AdminUser> findByStatusOrderByApprovedAtAsc(Integer status);

    Optional<AdminUser> findFirstByStatusOrderByApprovedAtAsc(Integer status);

    boolean existsByOpenid(String openid);
}
