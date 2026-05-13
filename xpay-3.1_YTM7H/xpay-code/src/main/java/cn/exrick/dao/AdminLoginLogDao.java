package cn.exrick.dao;

import cn.exrick.bean.AdminLoginLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AdminLoginLogDao extends JpaRepository<AdminLoginLog, Long> {

    List<AdminLoginLog> findByOpenidOrderByCreatedAtDesc(String openid);

    Page<AdminLoginLog> findByOpenidOrderByCreatedAtDesc(String openid, Pageable pageable);

    Page<AdminLoginLog> findByStatusOrderByCreatedAtDesc(Integer status, Pageable pageable);

    Page<AdminLoginLog> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Optional<AdminLoginLog> findFirstByOpenidAndStatusOrderByCreatedAtDesc(String openid, Integer status);

    int countByOpenidAndStatusAndCreatedAtAfter(String openid, Integer status, java.util.Date after);

    List<AdminLoginLog> findByOpenidAndCreatedAtAfterOrderByCreatedAtDesc(String openid, java.util.Date after);
}