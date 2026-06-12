package cn.exrick.dao;

import cn.exrick.bean.XpayTenant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface XpayTenantDao extends JpaRepository<XpayTenant, Long> {

    Optional<XpayTenant> findByTenantKey(String tenantKey);

    List<XpayTenant> findByOwnerAdminUserIdOrderByIdDesc(Long ownerAdminUserId);

    boolean existsByTenantKey(String tenantKey);
}
